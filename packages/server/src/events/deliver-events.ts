import type { DomainEvent, PendingEvent } from "@bebranded/elearning-core";

import type { ResolvedOptions } from "../config.js";

export type DeliveryReport = { readonly delivered: number; readonly failed: number };

const LEASE_MS = 60_000;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 6 * 60 * 60 * 1000;

/** Exponential backoff with jitter, capped at 6 hours (core/error-handling.mdc). */
export function nextAttemptDelay(attempts: number, random: () => number = Math.random): number {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

function describe(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : "Non-error thrown by the handler";
}

async function deliverOne(event: PendingEvent, options: ResolvedOptions): Promise<boolean> {
  // Handlers are keyed by type; TypeScript cannot correlate `event.type` with the handler's parameter.
  const handler = options.events[event.type] as ((event: DomainEvent) => Promise<void>) | undefined;
  try {
    // No handler for this type: the event is acknowledged, nobody listens to it.
    if (handler !== undefined) await handler(event);
    await options.storage.outbox.markEventDelivered(event.id, options.clock());
    return true;
  } catch (error) {
    const nextAttempt = new Date(options.clock().getTime() + nextAttemptDelay(event.attempts));
    await options.storage.outbox.markEventFailed(event.id, describe(error), nextAttempt);
    options.logger.warn("event delivery failed", {
      eventId: event.id,
      type: event.type,
      attempts: event.attempts,
    });
    return false;
  }
}

/**
 * Delivers due outbox events to the host's handlers, at least once (spec 04,
 * section 5). The host calls it from a scheduled job or after requests.
 * Events are delivered in order, one at a time.
 */
export async function deliverEvents(options: ResolvedOptions, limit = 50): Promise<DeliveryReport> {
  const now = options.clock();
  const events = await options.storage.outbox.claimPendingEvents(
    limit,
    now,
    new Date(now.getTime() + LEASE_MS),
  );
  let delivered = 0;
  for (const event of events) {
    if (await deliverOne(event, options)) delivered += 1;
  }
  return { delivered, failed: events.length - delivered };
}

import { sql } from "kysely";
import type { Kysely } from "kysely";

import { eventTypes, parseEventPayload, tenantIdSchema } from "@bebranded/elearning-core";
import type { DomainEvent, EventType, PendingEvent } from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";

const MAX_ERROR_LENGTH = 1000;

export async function appendEvent(db: Kysely<DB>, event: DomainEvent): Promise<void> {
  await db
    .insertInto("event_outbox")
    .values({
      id: event.id,
      tenant_id: event.tenantId,
      type: event.type,
      payload: JSON.stringify(event.payload),
      occurred_at: event.occurredAt,
      // Due as soon as it happened, on the caller's clock (injected time), not the database's.
      next_attempt_at: event.occurredAt,
    })
    .execute();
}

function isEventType(value: string): value is EventType {
  return (eventTypes as readonly string[]).includes(value);
}

/**
 * Claims due events with `FOR UPDATE SKIP LOCKED` and pushes their next
 * attempt to `leaseUntil` in the same statement, so two workers never get the
 * same event while the lease runs.
 */
export async function claimPendingEvents(
  db: Kysely<DB>,
  limit: number,
  now: Date,
  leaseUntil: Date,
): Promise<PendingEvent[]> {
  const due = db
    .selectFrom("event_outbox")
    .select("id")
    .where("delivered_at", "is", null)
    .where("next_attempt_at", "<=", now)
    .orderBy("next_attempt_at")
    .orderBy("id")
    .limit(limit)
    .forUpdate()
    .skipLocked();
  const rows = await db
    .updateTable("event_outbox")
    .set({ next_attempt_at: leaseUntil, attempts: sql`attempts + 1` })
    .where("id", "in", due)
    .returningAll()
    .execute();
  return rows
    .sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime())
    .flatMap((row): PendingEvent[] => {
      // Unknown types come from a newer version of the module: leave them for it.
      if (!isEventType(row.type)) return [];
      const event = {
        id: row.id,
        type: row.type,
        tenantId: row.tenant_id === null ? null : tenantIdSchema.parse(row.tenant_id),
        occurredAt: row.occurred_at,
        payload: parseEventPayload(row.type, row.payload),
        attempts: row.attempts,
      };
      // The payload was parsed with the schema of `row.type`; TypeScript cannot correlate the two.
      return [event as PendingEvent];
    });
}

export async function markEventDelivered(db: Kysely<DB>, id: string, at: Date): Promise<void> {
  await db
    .updateTable("event_outbox")
    .set({ delivered_at: at, last_error: null })
    .where("id", "=", id)
    .execute();
}

export async function markEventFailed(
  db: Kysely<DB>,
  id: string,
  error: string,
  nextAttemptAt: Date,
): Promise<void> {
  await db
    .updateTable("event_outbox")
    .set({ last_error: error.slice(0, MAX_ERROR_LENGTH), next_attempt_at: nextAttemptAt })
    .where("id", "=", id)
    .where("delivered_at", "is", null)
    .execute();
}

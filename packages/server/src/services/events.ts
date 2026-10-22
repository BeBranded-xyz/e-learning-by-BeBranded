import type {
  DomainEvent,
  EventPayload,
  EventType,
  StorageTransaction,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";

/** Writes an event to the outbox, in the transaction of the change it describes. */
export async function emit<T extends EventType>(
  tx: StorageTransaction,
  context: RequestContext,
  type: T,
  payload: EventPayload<T>,
): Promise<void> {
  const event = {
    id: context.newId(),
    type,
    tenantId: context.learner.tenantId,
    occurredAt: context.now(),
    payload,
  };
  // `event` is a DomainEvent<T>; TypeScript cannot narrow the mapped union from a generic T.
  await tx.appendEvent(event as DomainEvent);
}

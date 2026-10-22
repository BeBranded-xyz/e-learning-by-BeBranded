import { randomUUID } from "node:crypto";

import { sql } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { courseIdSchema } from "@bebranded/elearning-core";
import type { DomainEvent } from "@bebranded/elearning-core";

import { learner, tenantA } from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;
const t0 = new Date("2026-05-01T12:00:00Z");
const later = (seconds: number) => new Date(t0.getTime() + seconds * 1000);

function anEvent(occurredAt: Date = t0, tenantId = tenantA.tenantId): DomainEvent {
  return {
    id: randomUUID(),
    type: "course.started",
    tenantId,
    occurredAt,
    payload: { learnerId: learner, courseId: courseIdSchema.parse(randomUUID()) },
  };
}

async function append(...events: DomainEvent[]): Promise<void> {
  await database.storage.transaction(async (tx) => {
    for (const event of events) await tx.appendEvent(event);
  });
}

beforeAll(async () => {
  database = await createTestDatabase();
});

beforeEach(async () => {
  await sql`DELETE FROM ${sql.id(database.schema, "event_outbox")}`.execute(database.admin);
});

afterAll(async () => {
  await database.drop();
});

describe("event outbox", () => {
  it("claims due events oldest first, with their payload and attempt count", async () => {
    const first = anEvent(t0, null);
    const second = anEvent(later(1));
    await append(second, first);

    const claimed = await database.storage.outbox.claimPendingEvents(10, later(10), later(70));

    expect(claimed).toEqual([
      { ...first, attempts: 1 },
      { ...second, attempts: 1 },
    ]);
  });

  it("does not hand a leased event to a second worker before the lease ends", async () => {
    await append(anEvent());
    await database.storage.outbox.claimPendingEvents(10, later(0), later(60));

    expect(await database.storage.outbox.claimPendingEvents(10, later(30), later(90))).toEqual([]);
    expect(
      await database.storage.outbox.claimPendingEvents(10, later(61), later(121)),
    ).toHaveLength(1);
  });

  it("never gives the same event to concurrent workers", async () => {
    await append(...Array.from({ length: 20 }, () => anEvent()));

    const batches = await Promise.all(
      Array.from({ length: 4 }, () =>
        database.storage.outbox.claimPendingEvents(10, later(0), later(60)),
      ),
    );
    const ids = batches.flat().map((event) => event.id);

    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
  });

  it("respects the batch limit", async () => {
    await append(anEvent(), anEvent(), anEvent());

    expect(await database.storage.outbox.claimPendingEvents(2, later(0), later(60))).toHaveLength(
      2,
    );
  });

  it("never claims a delivered event again", async () => {
    const event = anEvent();
    await append(event);
    await database.storage.outbox.claimPendingEvents(10, later(0), later(60));
    await database.storage.outbox.markEventDelivered(event.id, later(1));

    expect(await database.storage.outbox.claimPendingEvents(10, later(3600), later(3660))).toEqual(
      [],
    );
  });

  it("reschedules a failed event and keeps a truncated error", async () => {
    const event = anEvent();
    await append(event);
    await database.storage.outbox.claimPendingEvents(10, later(0), later(60));
    await database.storage.outbox.markEventFailed(event.id, "x".repeat(5000), later(300));

    expect(await database.storage.outbox.claimPendingEvents(10, later(299), later(359))).toEqual(
      [],
    );
    const retried = await database.storage.outbox.claimPendingEvents(10, later(300), later(360));
    expect(retried.map((e) => e.attempts)).toEqual([2]);
    const row = await sql<{ length: number }>`
      SELECT length(last_error) AS length FROM ${sql.id(database.schema, "event_outbox")}`.execute(
      database.admin,
    );
    expect(row.rows[0]?.length).toBe(1000);
  });

  it("does not reschedule an event that was already delivered", async () => {
    const event = anEvent();
    await append(event);
    await database.storage.outbox.markEventDelivered(event.id, later(1));
    await database.storage.outbox.markEventFailed(event.id, "late failure", later(0));

    expect(await database.storage.outbox.claimPendingEvents(10, later(10), later(70))).toEqual([]);
  });

  it("leaves events of unknown types to the version that knows them", async () => {
    await sql`
      INSERT INTO ${sql.id(database.schema, "event_outbox")} (id, type, payload, occurred_at, next_attempt_at)
      VALUES (${randomUUID()}, 'future.event', '{}', ${t0}, ${t0})`.execute(database.admin);

    expect(await database.storage.outbox.claimPendingEvents(10, later(0), later(60))).toEqual([]);
  });

  it("drops the event when the transaction that wrote it rolls back", async () => {
    await expect(
      database.storage.transaction(async (tx) => {
        await tx.appendEvent(anEvent());
        throw new Error("business change failed");
      }),
    ).rejects.toThrow("business change failed");

    expect(await database.storage.outbox.claimPendingEvents(10, later(0), later(60))).toEqual([]);
  });
});

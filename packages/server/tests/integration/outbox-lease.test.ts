import { randomUUID } from "node:crypto";

import { expect, it } from "vitest";

import { courseIdSchema } from "@bebranded/elearning-core";
import type { DomainEvent } from "@bebranded/elearning-core";

import { createTestDatabase } from "../../../db/tests/support/test-database.js";
import { learner, tenantA } from "../../../db/tests/support/factories.js";
import { createElearning } from "../../src/index.js";

it("claims each event just before delivery so a slow batch does not duplicate queued events", async () => {
  const database = await createTestDatabase();
  let now = new Date("2026-05-01T12:00:00Z");
  const received: string[] = [];
  const events: DomainEvent[] = Array.from({ length: 4 }, () => ({
    id: randomUUID(),
    type: "course.started",
    tenantId: tenantA.tenantId,
    occurredAt: now,
    payload: { learnerId: learner, courseId: courseIdSchema.parse(randomUUID()) },
  }));
  const options = {
    storage: database.storage,
    identity: () => Promise.resolve(null),
    clock: () => now,
  };
  const second = createElearning({
    ...options,
    events: {
      "course.started": (event) => {
        received.push(event.id);
        return Promise.resolve();
      },
    },
  });
  const first = createElearning({
    ...options,
    events: {
      "course.started": async (event) => {
        received.push(event.id);
        now = new Date(now.getTime() + 25_000);
        if (received.length === 3) await second.deliverEvents();
      },
    },
  });
  try {
    await database.storage.transaction(async (tx) => {
      for (const event of events) await tx.appendEvent(event);
    });
    await first.deliverEvents();
    expect(received.sort()).toEqual(events.map((event) => event.id).sort());
  } finally {
    await database.drop();
  }
});

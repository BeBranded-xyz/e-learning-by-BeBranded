import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DomainEvent } from "@bebranded/elearning-core";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { createTestApp, rule, seed, tenant } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

let t: TestApp;
const received: DomainEvent[] = [];
let failures = 0;

beforeEach(async () => {
  received.length = 0;
  failures = 0;
  t = await createTestApp({
    events: {
      "lesson.completed": (event) => {
        if (failures > 0) {
          failures -= 1;
          return Promise.reject(new Error("host webhook timed out"));
        }
        received.push(event);
        return Promise.resolve();
      },
      "course.started": (event) => {
        received.push(event);
        return Promise.resolve();
      },
    },
  });
  const course = aCourse(tenant, { slug: "events" });
  const chapter = aChapter(course);
  const lesson = aLesson(chapter, { content: null });
  await seed(t.database, [
    { course, chapters: [chapter], lessons: [lesson], rules: [rule(course, "course", "allow")] },
  ]);
  await t.request("POST", `/v1/lessons/${lesson.id}/complete`, { as: "staff" });
});

afterEach(async () => {
  await t.database.drop();
});

describe("deliverEvents", () => {
  it("delivers due events to the host's handlers and acknowledges those without handler", async () => {
    const report = await t.app.deliverEvents();

    expect(report).toEqual({ delivered: 4, failed: 0 });
    expect(received.map((event) => event.type).sort()).toEqual([
      "course.started",
      "lesson.completed",
    ]);
    expect(received[0]).toMatchObject({ tenantId: tenant, payload: { learnerId: "staff-1" } });
    expect(await t.app.deliverEvents()).toEqual({ delivered: 0, failed: 0 });
  });

  it("retries a failed delivery after a backoff, with the same event id", async () => {
    failures = 1;

    expect(await t.app.deliverEvents()).toEqual({ delivered: 3, failed: 1 });
    expect(await t.app.deliverEvents()).toEqual({ delivered: 0, failed: 0 });
    expect(t.logs).toContainEqual(
      expect.objectContaining({ level: "warn", message: "event delivery failed" }),
    );

    t.advance(31_000);
    expect(await t.app.deliverEvents()).toEqual({ delivered: 1, failed: 0 });
    expect(received.filter((event) => event.type === "lesson.completed")).toHaveLength(1);
  });

  it("respects the batch limit", async () => {
    expect(await t.app.deliverEvents({ limit: 1 })).toEqual({ delivered: 1, failed: 0 });
    expect(await t.app.deliverEvents({ limit: 10 })).toEqual({ delivered: 3, failed: 0 });
  });
});

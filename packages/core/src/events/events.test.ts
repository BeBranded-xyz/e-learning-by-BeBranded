import { describe, expect, it } from "vitest";

import { testUuid } from "../../tests/factories/access.js";
import { eventTypes, parseEventPayload } from "./events.js";

describe("domain events", () => {
  it("lists every event type of spec 04 handled so far", () => {
    expect(eventTypes).toEqual([
      "lesson.started",
      "lesson.completed",
      "course.started",
      "course.completed",
      "enrollment.assigned",
      "quiz.attempt_submitted",
      "content.published",
    ]);
  });

  it("bounds the score of a quiz attempt", () => {
    const payload = {
      learnerId: "user-1",
      lessonId: testUuid(),
      courseId: testUuid(),
      attemptId: testUuid(),
      attemptNumber: 2,
      outcome: "graded",
      score: 0.75,
      passed: false,
    };

    expect(parseEventPayload("quiz.attempt_submitted", payload)).toEqual(payload);
    expect(() => parseEventPayload("quiz.attempt_submitted", { ...payload, score: 1.5 })).toThrow();
    expect(() =>
      parseEventPayload("quiz.attempt_submitted", { ...payload, outcome: "voided" }),
    ).toThrow();
  });

  it("parses a valid payload", () => {
    const payload = { learnerId: "user-1", lessonId: testUuid(), courseId: testUuid() };

    expect(parseEventPayload("lesson.completed", payload)).toEqual(payload);
  });

  it("requires an ISO date for course.completed", () => {
    const base = { learnerId: "user-1", courseId: testUuid() };

    expect(() =>
      parseEventPayload("course.completed", { ...base, completedAt: "yesterday" }),
    ).toThrow();
    expect(
      parseEventPayload("course.completed", { ...base, completedAt: "2026-10-22T10:00:00Z" }),
    ).toEqual({
      ...base,
      completedAt: "2026-10-22T10:00:00Z",
    });
  });

  it("rejects extra fields so events never carry unexpected personal data", () => {
    const payload = { learnerId: "user-1", courseId: testUuid(), email: "ada@example.com" };

    expect(() => parseEventPayload("course.started", payload)).toThrow();
  });

  it("accepts a null assigner and due date for enrollment.assigned", () => {
    const payload = { learnerId: "user-1", courseId: testUuid(), assignedBy: null, dueAt: null };

    expect(parseEventPayload("enrollment.assigned", payload)).toEqual(payload);
  });

  it("validates the target of content.published", () => {
    expect(() =>
      parseEventPayload("content.published", { targetType: "quiz", targetId: testUuid() }),
    ).toThrow();
    expect(
      parseEventPayload("content.published", { targetType: "course", targetId: testUuid() }),
    ).toMatchObject({
      targetType: "course",
    });
  });
});

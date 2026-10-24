import { describe, expect, it } from "vitest";

import { courseIdSchema, enrollmentIdSchema, learnerIdSchema } from "../content/ids.js";
import type { Enrollment } from "../ports/storage.types.js";
import { isOverdue, summarizeEnrollments } from "./course-report.js";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const at = (iso: string) => new Date(iso);

function anEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: enrollmentIdSchema.parse("5d7e3a1b-2c4f-4a6b-8d9e-0f1a2b3c4d5e"),
    courseId: courseIdSchema.parse("8a1b2c3d-4e5f-4a7b-9c8d-1e2f3a4b5c6d"),
    learnerId: learnerIdSchema.parse("learner-1"),
    source: "self",
    assignedBy: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    progress: 0,
    ...overrides,
  };
}

describe("isOverdue", () => {
  it.each([
    ["past due and not completed", { dueAt: at("2026-10-24T11:59:59Z") }, true],
    ["due exactly now", { dueAt: NOW }, false],
    ["due later", { dueAt: at("2026-10-25T00:00:00Z") }, false],
    ["without a due date", {}, false],
    [
      "past due but completed",
      { dueAt: at("2026-10-01T00:00:00Z"), completedAt: at("2026-10-02T00:00:00Z") },
      false,
    ],
  ])("is %s: %s", (_label, overrides, expected) => {
    expect(isOverdue(anEnrollment(overrides), NOW)).toBe(expected);
  });
});

describe("summarizeEnrollments", () => {
  it("counts enrolled, started, completed and overdue learners and averages progress", () => {
    const summary = summarizeEnrollments(
      [
        anEnrollment({ progress: 1, startedAt: at("2026-10-01Z"), completedAt: at("2026-10-02Z") }),
        anEnrollment({ progress: 0.5, startedAt: at("2026-10-01Z"), dueAt: at("2026-10-10Z") }),
        anEnrollment({ progress: 0 }),
      ],
      NOW,
    );

    expect(summary).toEqual({
      enrolled: 3,
      started: 2,
      completed: 1,
      overdue: 1,
      averageProgress: 0.5,
    });
  });

  it("rounds the average progress to six decimals", () => {
    const summary = summarizeEnrollments(
      [anEnrollment({ progress: 1 }), anEnrollment(), anEnrollment()],
      NOW,
    );

    expect(summary.averageProgress).toBe(0.333333);
  });

  it("answers zeros and a null average without enrollments", () => {
    expect(summarizeEnrollments([], NOW)).toEqual({
      enrolled: 0,
      started: 0,
      completed: 0,
      overdue: 0,
      averageProgress: null,
    });
  });
});

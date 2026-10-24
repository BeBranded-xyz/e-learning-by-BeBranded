import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { testUuid } from "../../tests/factories/access.js";
import { lessonIdSchema } from "../content/ids.js";
import type { LessonId } from "../content/ids.js";
import { advanceLessonStatus, computeProgress } from "./progress.js";
import type { LessonProgressStatus, ProgressLesson } from "./progress.js";

const statusArb = fc.constantFrom<LessonProgressStatus>("not_started", "in_progress", "completed");

function aLesson(overrides: Partial<ProgressLesson> = {}): ProgressLesson {
  return { id: lessonIdSchema.parse(testUuid()), isRequired: true, accessible: true, ...overrides };
}

describe("advanceLessonStatus", () => {
  it.each([
    ["not_started", "in_progress", "in_progress"],
    ["not_started", "completed", "completed"],
    ["in_progress", "completed", "completed"],
    ["in_progress", "not_started", "in_progress"],
    ["completed", "in_progress", "completed"],
    ["completed", "not_started", "completed"],
    ["in_progress", "in_progress", "in_progress"],
  ] as const)("%s then %s gives %s", (current, next, expected) => {
    expect(advanceLessonStatus(current, next)).toBe(expected);
  });

  it("never leaves completed, whatever comes next", () => {
    fc.assert(
      fc.property(fc.array(statusArb), (events) => {
        const final = events.reduce<LessonProgressStatus>(advanceLessonStatus, "completed");

        expect(final).toBe("completed");
      }),
    );
  });
});

describe("computeProgress", () => {
  it("counts completed required lessons over accessible required lessons", () => {
    const done = aLesson();
    const todo = aLesson();
    const statuses = new Map<LessonId, LessonProgressStatus>([
      [done.id, "completed"],
      [todo.id, "in_progress"],
    ]);

    expect(computeProgress([done, todo], statuses)).toEqual({
      completedRequired: 1,
      totalRequired: 2,
      ratio: 0.5,
      isComplete: false,
    });
  });

  it("ignores optional lessons, even when completed", () => {
    const required = aLesson();
    const optional = aLesson({ isRequired: false });
    const statuses = new Map<LessonId, LessonProgressStatus>([
      [required.id, "completed"],
      [optional.id, "completed"],
    ]);

    expect(computeProgress([required, optional], statuses)).toMatchObject({
      completedRequired: 1,
      totalRequired: 1,
      isComplete: true,
    });
  });

  it("does not count inaccessible lessons against the learner", () => {
    const visible = aLesson();
    const hidden = aLesson({ accessible: false });
    const statuses = new Map<LessonId, LessonProgressStatus>([[visible.id, "completed"]]);

    expect(computeProgress([visible, hidden], statuses)).toMatchObject({
      totalRequired: 1,
      ratio: 1,
      isComplete: true,
    });
  });

  it("does not count progress kept on a lesson that became inaccessible", () => {
    const hidden = aLesson({ accessible: false });
    const statuses = new Map<LessonId, LessonProgressStatus>([[hidden.id, "completed"]]);

    expect(computeProgress([hidden, aLesson()], statuses)).toMatchObject({
      completedRequired: 0,
      totalRequired: 1,
    });
  });

  it("reports 0 and not complete when there is no required lesson", () => {
    expect(computeProgress([aLesson({ isRequired: false })], new Map())).toEqual({
      completedRequired: 0,
      totalRequired: 0,
      ratio: 0,
      isComplete: false,
    });
  });

  it("treats lessons without progress as not completed", () => {
    expect(computeProgress([aLesson()], new Map())).toMatchObject({ ratio: 0, isComplete: false });
  });

  it("keeps the ratio between 0 and 1 and complete only at 1", () => {
    const lessonArb = fc
      .record({ isRequired: fc.boolean(), accessible: fc.boolean(), status: statusArb })
      .map(({ status, ...flags }) => ({ lesson: aLesson(flags), status }));

    fc.assert(
      fc.property(fc.array(lessonArb, { maxLength: 30 }), (entries) => {
        const statuses = new Map(entries.map(({ lesson, status }) => [lesson.id, status]));
        const progress = computeProgress(
          entries.map(({ lesson }) => lesson),
          statuses,
        );

        expect(progress.ratio).toBeGreaterThanOrEqual(0);
        expect(progress.ratio).toBeLessThanOrEqual(1);
        expect(progress.isComplete).toBe(progress.totalRequired > 0 && progress.ratio === 1);
      }),
    );
  });
});

it("completes at the configured percentage of accessible required lessons", () => {
  const lessons = [
    aLesson(),
    aLesson(),
    aLesson({ isRequired: false }),
    aLesson({ accessible: false }),
  ];
  const statuses = new Map<LessonId, LessonProgressStatus>([
    [lessons[0]?.id ?? lessonIdSchema.parse(testUuid()), "completed"],
  ]);
  expect(
    computeProgress(lessons, statuses, { type: "percentage", threshold: 0.5 }).isComplete,
  ).toBe(true);
  expect(
    computeProgress(lessons, statuses, { type: "percentage", threshold: 0.51 }).isComplete,
  ).toBe(false);
  expect(computeProgress([], statuses, { type: "percentage", threshold: 0.01 }).isComplete).toBe(
    false,
  );
});

it("lowering the threshold never revokes completion for the same accessible lessons", () => {
  fc.assert(
    fc.property(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }),
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 100 }),
      (completed, first, second) => {
        const lessons = completed.map(() => aLesson());
        const statuses = new Map<LessonId, LessonProgressStatus>(
          lessons.map((lesson, index) => [
            lesson.id,
            completed[index] ? "completed" : "not_started",
          ]),
        );
        const lower = computeProgress(lessons, statuses, {
          type: "percentage",
          threshold: Math.min(first, second) / 100,
        });
        const higher = computeProgress(lessons, statuses, {
          type: "percentage",
          threshold: Math.max(first, second) / 100,
        });
        if (higher.isComplete) expect(lower.isComplete).toBe(true);
        expect(lower.ratio).toBe(higher.ratio);
      },
    ),
  );
});

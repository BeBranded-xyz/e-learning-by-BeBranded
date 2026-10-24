import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { moveChapter, moveLessonBy, moveLessonTo, orderOf, reorderBody } from "./reorder.js";
import type { TreeOrder } from "./reorder.js";

const order: TreeOrder = [
  { id: "c1", lessonIds: ["a", "b"] },
  { id: "c2", lessonIds: ["c"] },
  { id: "c3", lessonIds: [] },
];

describe("orderOf and reorderBody", () => {
  it("reads a tree and writes the reorder body", () => {
    const tree = { chapters: [{ id: "c1", lessons: [{ id: "a" }, { id: "b" }] }] };

    expect(reorderBody("course", orderOf(tree))).toEqual({
      course_id: "course",
      chapters: [{ id: "c1", lesson_ids: ["a", "b"] }],
    });
  });
});

describe("moveChapter", () => {
  it("swaps a chapter with its neighbour", () => {
    expect(moveChapter(order, "c2", -1).map((c) => c.id)).toEqual(["c2", "c1", "c3"]);
    expect(moveChapter(order, "c2", 1).map((c) => c.id)).toEqual(["c1", "c3", "c2"]);
  });

  it("leaves the order unchanged at the ends and for an unknown chapter", () => {
    expect(moveChapter(order, "c1", -1)).toEqual(order);
    expect(moveChapter(order, "c3", 1)).toEqual(order);
    expect(moveChapter(order, "nope", 1)).toBe(order);
  });
});

describe("moveLessonTo", () => {
  it("moves a lesson inside its chapter", () => {
    expect(moveLessonTo(order, "a", { chapterId: "c1", index: 1 })[0]?.lessonIds).toEqual([
      "b",
      "a",
    ]);
  });

  it("moves a lesson to another chapter, even an empty one", () => {
    const moved = moveLessonTo(order, "a", { chapterId: "c3", index: 0 });

    expect(moved).toEqual([
      { id: "c1", lessonIds: ["b"] },
      { id: "c2", lessonIds: ["c"] },
      { id: "c3", lessonIds: ["a"] },
    ]);
  });

  it("clamps the index", () => {
    expect(moveLessonTo(order, "a", { chapterId: "c2", index: 99 })[1]?.lessonIds).toEqual([
      "c",
      "a",
    ]);
    expect(moveLessonTo(order, "c", { chapterId: "c1", index: -5 })[0]?.lessonIds).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("ignores an unknown lesson or chapter", () => {
    expect(moveLessonTo(order, "zz", { chapterId: "c1", index: 0 })).toBe(order);
    expect(moveLessonTo(order, "a", { chapterId: "zz", index: 0 })).toBe(order);
  });
});

describe("moveLessonBy", () => {
  it("moves a lesson up and down inside its chapter", () => {
    expect(moveLessonBy(order, "b", -1)[0]?.lessonIds).toEqual(["b", "a"]);
    expect(moveLessonBy(order, "a", 1)[0]?.lessonIds).toEqual(["b", "a"]);
  });

  it("crosses into the neighbouring chapter at the edges", () => {
    expect(moveLessonBy(order, "b", 1)).toEqual([
      { id: "c1", lessonIds: ["a"] },
      { id: "c2", lessonIds: ["b", "c"] },
      { id: "c3", lessonIds: [] },
    ]);
    expect(moveLessonBy(order, "c", -1)).toEqual([
      { id: "c1", lessonIds: ["a", "b", "c"] },
      { id: "c2", lessonIds: [] },
      { id: "c3", lessonIds: [] },
    ]);
  });

  it("stops at the ends of the course and ignores unknown lessons", () => {
    expect(moveLessonBy(order, "a", -1)).toBe(order);
    expect(moveLessonBy([{ id: "c1", lessonIds: ["a"] }], "a", 1)).toEqual([
      { id: "c1", lessonIds: ["a"] },
    ]);
    expect(moveLessonBy(order, "zz", 1)).toBe(order);
  });

  it("never loses or duplicates a lesson", () => {
    const lessons = ["a", "b", "c"];
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(...lessons), fc.constantFrom<-1 | 1>(-1, 1)), {
          maxLength: 30,
        }),
        (moves) => {
          const final = moves.reduce(
            (current, [id, delta]) => moveLessonBy(current, id, delta),
            order,
          );
          expect(final.flatMap((chapter) => chapter.lessonIds).sort()).toEqual(lessons);
          expect(final.map((chapter) => chapter.id)).toEqual(["c1", "c2", "c3"]);
        },
      ),
    );
  });
});

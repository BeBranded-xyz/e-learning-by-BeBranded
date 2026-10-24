/** The order of a course's chapters and lessons, as `POST /v1/admin/reorder` takes it. */
export type TreeOrder = readonly { readonly id: string; readonly lessonIds: readonly string[] }[];

type OrderedTree = {
  readonly chapters: readonly {
    readonly id: string;
    readonly lessons: readonly { id: string }[];
  }[];
};

export function orderOf(tree: OrderedTree): TreeOrder {
  return tree.chapters.map((chapter) => ({
    id: chapter.id,
    lessonIds: chapter.lessons.map((lesson) => lesson.id),
  }));
}

export function reorderBody(courseId: string, order: TreeOrder) {
  return {
    course_id: courseId,
    chapters: order.map((chapter) => ({ id: chapter.id, lesson_ids: chapter.lessonIds })),
  };
}

function swap<T>(items: readonly T[], index: number, other: number): T[] {
  const copy = [...items];
  const [a, b] = [copy[index], copy[other]];
  if (a === undefined || b === undefined) return copy;
  copy[index] = b;
  copy[other] = a;
  return copy;
}

/** Moves a chapter one place up (-1) or down (1); unchanged at the ends. */
export function moveChapter(order: TreeOrder, chapterId: string, delta: -1 | 1): TreeOrder {
  const index = order.findIndex((chapter) => chapter.id === chapterId);
  return index === -1 ? order : swap(order, index, index + delta);
}

function locate(order: TreeOrder, lessonId: string) {
  const chapterIndex = order.findIndex((chapter) => chapter.lessonIds.includes(lessonId));
  const lessonIndex = order[chapterIndex]?.lessonIds.indexOf(lessonId) ?? -1;
  return { chapterIndex, lessonIndex };
}

/**
 * Puts a lesson at `index` of a chapter (drag and drop). The index counts
 * the target chapter's lessons without the moved one; it is clamped.
 */
export function moveLessonTo(
  order: TreeOrder,
  lessonId: string,
  target: { readonly chapterId: string; readonly index: number },
): TreeOrder {
  if (locate(order, lessonId).chapterIndex === -1) return order;
  if (!order.some((chapter) => chapter.id === target.chapterId)) return order;
  const without = order.map((chapter) => ({
    id: chapter.id,
    lessonIds: chapter.lessonIds.filter((id) => id !== lessonId),
  }));
  return without.map((chapter) => {
    if (chapter.id !== target.chapterId) return chapter;
    const index = Math.max(0, Math.min(target.index, chapter.lessonIds.length));
    return {
      id: chapter.id,
      lessonIds: [
        ...chapter.lessonIds.slice(0, index),
        lessonId,
        ...chapter.lessonIds.slice(index),
      ],
    };
  });
}

/**
 * Moves a lesson one place up or down (keyboard). At the edge of its
 * chapter it goes to the end of the previous chapter or the start of the
 * next one; unchanged at the ends of the course.
 */
export function moveLessonBy(order: TreeOrder, lessonId: string, delta: -1 | 1): TreeOrder {
  const { chapterIndex, lessonIndex } = locate(order, lessonId);
  const chapter = order[chapterIndex];
  if (chapter === undefined) return order;
  const next = lessonIndex + delta;
  if (next >= 0 && next < chapter.lessonIds.length) {
    return moveLessonTo(order, lessonId, { chapterId: chapter.id, index: next });
  }
  const neighbour = order[chapterIndex + delta];
  if (neighbour === undefined) return order;
  const index = delta === -1 ? neighbour.lessonIds.length : 0;
  return moveLessonTo(order, lessonId, { chapterId: neighbour.id, index });
}

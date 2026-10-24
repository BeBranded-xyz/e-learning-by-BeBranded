import { AppError } from "@bebranded/elearning-core";
import type { StorageTransaction, TenantScope } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { presentCourseTree } from "../presenters/admin.presenters.js";
import { loadCourseTree } from "../services/course-tree.js";
import { exportFormatsFor } from "../services/export.js";
import type { CourseTree } from "../services/course-tree.js";
import { reorderBody } from "./admin.schemas.js";
import type { ReorderBody } from "./admin.schemas.js";
import { found } from "./ids.js";
import { parseBody } from "./parse-body.js";

/** 1,000 lesson ids of 36 characters fit; the default 16 kB admin limit does not. */
const BODY_LIMIT = 131_072;

const treeOutOfDate = () =>
  new AppError(
    "conflict",
    "tree_out_of_date",
    "The course changed since it was loaded. Reload it and try again.",
  );

function sameIds(stored: readonly { id: string }[], sent: readonly string[]): boolean {
  const ids = new Set(sent);
  return stored.length === ids.size && stored.every((item) => ids.has(item.id));
}

/** The body must name every chapter and every lesson of the course, nothing else. */
function assertCompleteOrder(tree: CourseTree, body: ReorderBody): void {
  const chapters = sameIds(
    tree.chapters,
    body.chapters.map((chapter) => chapter.id),
  );
  const lessons = sameIds(
    tree.lessons,
    body.chapters.flatMap((chapter) => chapter.lesson_ids),
  );
  if (!chapters || !lessons) throw treeOutOfDate();
}

/** Writes only the rows whose chapter or position changes. */
async function applyOrder(
  tx: StorageTransaction,
  scope: TenantScope,
  tree: CourseTree,
  body: ReorderBody,
): Promise<void> {
  const chapters = new Map(tree.chapters.map((chapter) => [chapter.id, chapter]));
  const lessons = new Map(tree.lessons.map((lesson) => [lesson.id, lesson]));
  for (const [chapterPosition, entry] of body.chapters.entries()) {
    if (chapters.get(entry.id)?.position !== chapterPosition) {
      found(await tx.updateChapter(scope, entry.id, { position: chapterPosition }));
    }
    for (const [position, lessonId] of entry.lesson_ids.entries()) {
      const lesson = lessons.get(lessonId);
      if (lesson?.chapterId === entry.id && lesson.position === position) continue;
      const chapterId = lesson?.chapterId === entry.id ? undefined : entry.id;
      found(await tx.updateLesson(scope, lessonId, { chapterId, position }));
    }
  }
}

/**
 * POST /v1/admin/reorder (spec 04, section 8): renumbers the chapters and
 * lessons of one course, moving lessons between its chapters, in a single
 * transaction. A body that does not match the stored tree answers 409.
 */
export async function reorderCourse(context: RequestContext): Promise<Response> {
  const body = await parseBody(context, reorderBody, BODY_LIMIT);
  const { course, tree } = await context.storage.transaction(async (tx) => {
    const locked = found(await tx.lockCourse(context.scope, body.course_id));
    const before = await loadCourseTree(tx, context.scope, locked);
    assertCompleteOrder(before, body);
    await applyOrder(tx, context.scope, before, body);
    return { course: locked, tree: await loadCourseTree(tx, context.scope, locked) };
  });
  return json(
    presentCourseTree(course, tree, context.scope, exportFormatsFor(context, course)),
    context.requestId,
  );
}

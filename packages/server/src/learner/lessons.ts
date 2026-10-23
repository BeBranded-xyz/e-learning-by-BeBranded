import { AppError, validateLessonDocument } from "@bebranded/elearning-core";
import { renderLessonHtml } from "@bebranded/elearning-editor/server";

import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { presentEnrollment, presentLesson } from "../presenters/learner.presenters.js";
import { loadAccessibleLesson } from "../services/lesson-access.js";
import { recordLessonProgress } from "../services/progress.js";

/**
 * Stored content was validated on write; it is validated again before
 * rendering so a document written by an older version or by hand never
 * reaches the page unchecked.
 */
function renderContent(context: RequestContext, lessonId: string, content: unknown): string {
  if (content === null) return "";
  const document = validateLessonDocument(content);
  if (document.ok) return renderLessonHtml(document.value);
  context.logger.error("stored lesson content is invalid", {
    lessonId,
    requestId: context.requestId,
  });
  return "";
}

/** GET /v1/lessons/:id: the lesson rendered to HTML, with the learner's status. Never mutates state. */
export async function getLesson(
  context: RequestContext,
  lessonId: string | undefined,
): Promise<Response> {
  const { lesson, view } = await loadAccessibleLesson(context, lessonId);
  const status = view.chapters
    .flatMap((chapter) => chapter.lessons)
    .find((entry) => entry.lesson.id === lesson.id)?.status;
  const html = renderContent(context, lesson.id, lesson.content);
  return json(presentLesson(lesson, html, status ?? "not_started"), context.requestId);
}

async function progress(
  context: RequestContext,
  lessonId: string | undefined,
  target: "in_progress" | "completed",
) {
  const { lesson, course, view } = await loadAccessibleLesson(context, lessonId);
  if (target === "completed" && lesson.type !== "text") {
    throw new AppError(
      "conflict",
      "completion_not_manual",
      "This lesson is completed by watching or passing it.",
    );
  }
  const outcome = await recordLessonProgress(context, {
    course,
    lesson,
    progressLessons: view.progressLessons,
    target,
  });
  return json(
    { status: outcome.status, enrollment: presentEnrollment(outcome.enrollment) },
    context.requestId,
  );
}

/** POST /v1/lessons/:id/start: records that the learner opened the lesson. Idempotent. */
export function startLesson(
  context: RequestContext,
  lessonId: string | undefined,
): Promise<Response> {
  return progress(context, lessonId, "in_progress");
}

/** POST /v1/lessons/:id/complete: "Mark as done" on a text lesson. Idempotent. */
export function completeLesson(
  context: RequestContext,
  lessonId: string | undefined,
): Promise<Response> {
  return progress(context, lessonId, "completed");
}

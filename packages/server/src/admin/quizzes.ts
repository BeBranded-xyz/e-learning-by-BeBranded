import { z } from "zod";

import {
  AppError,
  editorDocumentToQuiz,
  lessonIdSchema,
  quizIdSchema,
} from "@bebranded/elearning-core";
import type { LessonDetail, Quiz, QuizDefinition } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { assertFilesExist } from "../services/files.js";
import { contextBlocks, quizVersion, requireQuizLesson } from "../services/quiz.js";
import { found, parseId } from "./ids.js";
import { BODY_LIMITS, parseBody } from "./parse-body.js";

const saveQuizBody = z.strictObject({ document: z.json() });

/** The quiz for the editor, with the edit warning count of spec 07. Admin only: it holds the answers. */
async function presentAdminQuiz(context: RequestContext, lesson: LessonDetail, quiz: Quiz | null) {
  return {
    lesson_id: lesson.id,
    document: quiz?.editorDocument ?? null,
    question_count: quiz?.definition.questions.length ?? 0,
    version: quiz?.version ?? null,
    learners_attempted: await context.storage.countQuizLearners(context.scope, lesson.id),
  };
}

export async function loadQuizLesson(context: RequestContext, rawId: string | undefined) {
  const lesson = found(
    await context.storage.findLesson(context.scope, parseId(lessonIdSchema, rawId)),
  );
  requireQuizLesson(lesson);
  return lesson;
}

function definitionOf(document: unknown): QuizDefinition {
  const result = editorDocumentToQuiz(document);
  if (result.ok) return result.value;
  throw new AppError("validation", "invalid_content", "The quiz is invalid.", {
    details: {
      issues: result.error.map((issue) => ({
        code: issue.code,
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

/** GET /v1/admin/lessons/:id/quiz: the editor document of a quiz lesson; null before the first save. */
export async function getAdminQuiz(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const lesson = await loadQuizLesson(context, rawId);
  const quiz = await context.storage.findQuiz(context.scope, lesson.id);
  return json(await presentAdminQuiz(context, lesson, quiz), context.requestId);
}

/**
 * PUT /v1/admin/lessons/:id/quiz: validates the editor document, derives the
 * graded definition and stores both (spec 07). Attempts already taken keep
 * their score; an attempt left open on the previous version is voided.
 */
export async function saveAdminQuiz(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const body = await parseBody(context, saveQuizBody, BODY_LIMITS.lesson);
  const lesson = await loadQuizLesson(context, rawId);
  const definition = definitionOf(body.document);
  await assertFilesExist(context, contextBlocks(definition));
  const existing = await context.storage.findQuiz(context.scope, lesson.id);
  const quiz: Quiz = {
    id: existing?.id ?? quizIdSchema.parse(context.newId()),
    lessonId: lesson.id,
    editorDocument: body.document,
    definition,
    version: await quizVersion(definition),
  };
  found(await context.storage.transaction((tx) => tx.saveQuiz(context.scope, quiz)));
  return json(await presentAdminQuiz(context, lesson, quiz), context.requestId);
}

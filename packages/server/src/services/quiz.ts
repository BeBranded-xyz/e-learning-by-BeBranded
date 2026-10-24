import {
  AppError,
  presentQuiz,
  quizLessonSettingsSchema,
  toSurveyJson,
} from "@bebranded/elearning-core";
import type {
  LessonDetail,
  LessonDocument,
  Quiz,
  QuizAttempt,
  QuizDefinition,
  QuizLessonSettings,
  QuizPresentation,
  QuizStanding,
  SurveyJson,
} from "@bebranded/elearning-core";
import { renderLessonHtml } from "@bebranded/elearning-editor/server";
import type { RenderOptions } from "@bebranded/elearning-editor/server";

import type { RequestContext } from "../context.js";

function quizSettings(lesson: Pick<LessonDetail, "settings">): QuizLessonSettings {
  const parsed = quizLessonSettingsSchema.safeParse(lesson.settings);
  return parsed.success ? parsed.data : quizLessonSettingsSchema.parse({});
}

/** SHA-256 of the definition (spec 07, "Editing a quiz"); Web Crypto, so it runs on every runtime. */
export async function quizVersion(definition: QuizDefinition): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(definition));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** An unsigned 32-bit seed taken from the attempt's random id. */
export function seedOf(attemptId: string): number {
  return Number.parseInt(attemptId.replaceAll("-", "").slice(0, 8), 16) >>> 0;
}

/** The order of questions and options an attempt shows, rebuilt identically for grading. */
export function presentationOf(quiz: Quiz, attempt: QuizAttempt): QuizPresentation {
  return presentQuiz(quiz.definition, {
    seed: attempt.seed,
    shuffleQuestions: attempt.shuffleQuestions,
    shuffleOptions: attempt.shuffleOptions,
  });
}

/** The learner's survey: context blocks rendered and sanitized here, never answers. */
export function surveyOf(presentation: QuizPresentation, options: RenderOptions = {}): SurveyJson {
  return toSurveyJson(presentation, (blocks) => renderLessonHtml(blocks, options));
}

/** Every context block of a quiz: question intros and the outro. */
export function contextBlocks(definition: QuizDefinition): LessonDocument {
  return [...definition.questions.flatMap((question) => question.intro), ...definition.outro];
}

export function requireQuizLesson(lesson: LessonDetail): void {
  if (lesson.type !== "quiz") {
    throw new AppError("conflict", "not_a_quiz_lesson", "This lesson has no quiz.");
  }
}

export const quizNotReady = () =>
  new AppError("conflict", "quiz_not_ready", "This quiz has no questions yet.");

export type LessonQuiz = {
  readonly quiz: Quiz | null;
  readonly standing: QuizStanding;
  readonly settings: QuizLessonSettings;
};

/** The quiz of a lesson for one learner: whether it exists, its rules, and their standing. */
export async function loadLessonQuiz(
  context: RequestContext,
  lesson: LessonDetail,
): Promise<LessonQuiz> {
  const [quiz, standing] = await Promise.all([
    context.storage.findQuiz(context.scope, lesson.id),
    context.storage.findQuizStanding(context.scope, context.learner.learnerId, lesson.id),
  ]);
  return { quiz, standing, settings: quizSettings(lesson) };
}

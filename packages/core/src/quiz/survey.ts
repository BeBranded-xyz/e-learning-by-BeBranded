import type { LessonDocument } from "../content/lesson-document.types.js";
import type { QuestionResult } from "./grade.js";
import type { PresentedOption, PresentedQuestion, QuizPresentation } from "./present.js";
import { QUIZ_LIMITS } from "./quiz.schemas.js";
import type { QuizAnswers } from "./quiz.schemas.js";

/**
 * The SurveyJS JSON a learner receives (spec 07, "Security"). Built from an
 * allowlist of fields: prompts, option texts and opaque values. Correct
 * answers, accepted answers, explanations, points and definition ids are
 * never copied, so there is nothing to strip and nothing to forget.
 */
export type SurveyChoice = { readonly value: string; readonly text: string };

export type SurveyElement =
  | { readonly type: "html"; readonly name: string; readonly html: string }
  | {
      readonly type: "radiogroup" | "checkbox" | "ranking";
      readonly name: string;
      readonly title: string;
      readonly choices: readonly SurveyChoice[];
    }
  | { readonly type: "boolean"; readonly name: string; readonly title: string }
  | {
      readonly type: "text";
      readonly name: string;
      readonly title: string;
      readonly maxLength: number;
    }
  | {
      readonly type: "matrix";
      readonly name: string;
      readonly title: string;
      readonly rows: readonly SurveyChoice[];
      readonly columns: readonly SurveyChoice[];
    };

export type SurveyJson = {
  readonly pages: readonly [{ readonly name: "quiz"; readonly elements: readonly SurveyElement[] }];
};

/** Renders context blocks to sanitized HTML (the editor package's renderer on the server). */
export type RenderBlocks = (blocks: LessonDocument) => string;

const choices = (options: readonly PresentedOption[]): SurveyChoice[] =>
  options.map(({ value, text }) => ({ value, text }));

function questionElement(presented: PresentedQuestion): SurveyElement {
  const { name, question } = presented;
  const title = question.prompt;
  switch (question.kind) {
    case "single_choice":
      return { type: "radiogroup", name, title, choices: choices(presented.options) };
    case "multiple_choice":
      return { type: "checkbox", name, title, choices: choices(presented.options) };
    case "ordering":
      return { type: "ranking", name, title, choices: choices(presented.options) };
    case "true_false":
      return { type: "boolean", name, title };
    case "short_answer":
      return { type: "text", name, title, maxLength: QUIZ_LIMITS.maxShortAnswerLength };
    case "matching":
      return {
        type: "matrix",
        name,
        title,
        rows: choices(presented.rows),
        columns: choices(presented.columns),
      };
  }
}

/** The learner's survey for one attempt: intro blocks, then the question, in the order shown. */
export function toSurveyJson(presentation: QuizPresentation, render: RenderBlocks): SurveyJson {
  const elements = presentation.questions.flatMap((presented): SurveyElement[] => {
    const intro: SurveyElement[] =
      presented.question.intro.length === 0
        ? []
        : [
            {
              type: "html",
              name: `${presented.name}_intro`,
              html: render(presented.question.intro),
            },
          ];
    return [...intro, questionElement(presented)];
  });
  const outro: SurveyElement[] =
    presentation.outro.length === 0
      ? []
      : [{ type: "html", name: "outro", html: render(presentation.outro) }];
  return { pages: [{ name: "quiz", elements: [...elements, ...outro] }] };
}

export type QuizCorrection = {
  readonly name: string;
  readonly correct: boolean;
  readonly earned: number;
  readonly possible: number;
  /** In the attempt's values, so the player can mark the right options. */
  readonly correctAnswer: QuizAnswers[string];
  readonly explanation: string;
};

const valueOf = (options: readonly PresentedOption[], id: string) =>
  options.find((option) => option.id === id)?.value ?? "";

function correctAnswer(presented: PresentedQuestion): QuizAnswers[string] {
  const { question, options } = presented;
  switch (question.kind) {
    case "single_choice":
      return valueOf(options, question.correctOptionId);
    case "multiple_choice":
      return options.filter((o) => question.correctOptionIds.includes(o.id)).map((o) => o.value);
    case "true_false":
      return question.answer;
    case "short_answer":
      return question.acceptedAnswers[0] ?? "";
    case "ordering":
      return question.items.map((item) => valueOf(options, item.id));
    case "matching":
      return Object.fromEntries(
        presented.rows.map((row) => [row.value, valueOf(presented.columns, row.id)]),
      );
  }
}

/**
 * Corrections for an attempt (spec 07, `show_correction`). Only built when
 * the quiz settings allow them; they reveal the answers.
 */
export function buildCorrections(
  presentation: QuizPresentation,
  results: readonly QuestionResult[],
): QuizCorrection[] {
  return presentation.questions.map((presented) => {
    const result = results.find((entry) => entry.name === presented.name);
    const earned = result?.earned ?? 0;
    const possible = presented.question.points;
    return {
      name: presented.name,
      correct: earned === possible,
      earned,
      possible,
      correctAnswer: correctAnswer(presented),
      explanation: presented.question.explanation,
    };
  });
}

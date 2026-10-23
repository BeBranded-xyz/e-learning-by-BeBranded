import type { LessonDocument } from "../content/lesson-document.types.js";
import type { QuizDefinition, QuizQuestion } from "./quiz.schemas.js";
import { derange, seededRandom, shuffle } from "./shuffle.js";

/**
 * An option as shown in one attempt. `value` is what the survey and the
 * learner's answers carry: opaque and numbered in the order shown, so it
 * tells nothing about the authored order or the correct answer. `id` maps
 * it back to the definition and never leaves the server.
 */
export type PresentedOption = {
  readonly value: string;
  readonly text: string;
  readonly id: string;
};

export type PresentedQuestion = {
  /** `q1`, `q2`… in the order shown. */
  readonly name: string;
  readonly question: QuizQuestion;
  /** Single choice, multiple choice and ordering. */
  readonly options: readonly PresentedOption[];
  /** Matching: the left items. */
  readonly rows: readonly PresentedOption[];
  /** Matching: the right items, never in the same order as the rows. */
  readonly columns: readonly PresentedOption[];
};

/** One attempt's view of a quiz, rebuilt identically from the same seed. */
export type QuizPresentation = {
  readonly questions: readonly PresentedQuestion[];
  readonly outro: LessonDocument;
};

export type PresentationOptions = {
  /** 32-bit seed stored with the attempt. */
  readonly seed: number;
  readonly shuffleQuestions: boolean;
  readonly shuffleOptions: boolean;
};

type Source = { readonly id: string; readonly text: string };

const numbered = (prefix: string, sources: readonly Source[]): PresentedOption[] =>
  sources.map((source, index) => ({ value: `${prefix}${index + 1}`, ...source }));

function present(
  question: QuizQuestion,
  name: string,
  random: () => number,
  shuffleOptions: boolean,
): PresentedQuestion {
  const base = { name, question, options: [], rows: [], columns: [] };
  const maybeShuffle = <T>(items: readonly T[]) =>
    shuffleOptions ? shuffle(items, random) : items;
  switch (question.kind) {
    case "single_choice":
    case "multiple_choice":
      return { ...base, options: numbered("o", maybeShuffle(question.options)) };
    case "ordering":
      // Always shuffled: the authored order is the answer.
      return { ...base, options: numbered("o", derange(question.items, random, question.items)) };
    case "matching": {
      const rows = maybeShuffle(question.pairs);
      return {
        ...base,
        rows: numbered(
          "r",
          rows.map((pair) => ({ id: pair.id, text: pair.left })),
        ),
        columns: numbered(
          "c",
          derange(rows, random, rows).map((pair) => ({ id: pair.id, text: pair.right })),
        ),
      };
    }
    case "true_false":
    case "short_answer":
      return base;
  }
}

/**
 * Orders questions and options for one attempt (spec 07, "Shuffling"). Each
 * question keeps its intro blocks; the matching columns and the ordering
 * items are always shuffled, since their authored order is the answer.
 */
export function presentQuiz(
  definition: QuizDefinition,
  options: PresentationOptions,
): QuizPresentation {
  const random = seededRandom(options.seed);
  const ordered = options.shuffleQuestions
    ? shuffle(definition.questions, random)
    : definition.questions;
  return {
    questions: ordered.map((question, index) =>
      present(question, `q${index + 1}`, random, options.shuffleOptions),
    ),
    outro: definition.outro,
  };
}

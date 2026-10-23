import type { PresentedOption, PresentedQuestion, QuizPresentation } from "./present.js";
import type { QuizAnswers } from "./quiz.schemas.js";

type Answer = QuizAnswers[string] | undefined;

export type QuestionResult = {
  /** The question's id in the definition. */
  readonly questionId: string;
  /** Its name in the attempt (`q1`…). */
  readonly name: string;
  readonly earned: number;
  readonly possible: number;
};

export type QuizGrade = {
  readonly pointsEarned: number;
  readonly pointsPossible: number;
  /** `pointsEarned / pointsPossible`, between 0 and 1, rounded to 6 decimals. */
  readonly score: number;
  readonly questions: readonly QuestionResult[];
};

/** Lowercase, without accents, with single spaces (spec 07, "Short answer"). */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ")
    .trim();
}

const idOf = (options: readonly PresentedOption[], value: string) =>
  options.find((option) => option.value === value)?.id;

function multipleChoiceRatio(presented: PresentedQuestion, answer: Answer): number {
  if (presented.question.kind !== "multiple_choice" || !Array.isArray(answer)) return 0;
  const correct = new Set(presented.question.correctOptionIds);
  const ticked = new Set(answer.map((value) => idOf(presented.options, value)));
  ticked.delete(undefined);
  const right = [...ticked].filter((id) => id !== undefined && correct.has(id)).length;
  const wrong = ticked.size - right;
  if (presented.question.partialCredit) return Math.max(0, right - wrong) / correct.size;
  return right === correct.size && wrong === 0 ? 1 : 0;
}

function orderingRatio(presented: PresentedQuestion, answer: Answer): number {
  if (presented.question.kind !== "ordering" || !Array.isArray(answer)) return 0;
  const given = answer.map((value) => idOf(presented.options, value));
  const expected = presented.question.items.map((item) => item.id);
  return given.length === expected.length && given.every((id, i) => id === expected[i]) ? 1 : 0;
}

function matchingRatio(presented: PresentedQuestion, answer: Answer): number {
  if (typeof answer !== "object" || Array.isArray(answer)) return 0;
  const matched = presented.rows.filter((row) => {
    const column = answer[row.value];
    return column !== undefined && idOf(presented.columns, column) === row.id;
  });
  return matched.length / presented.rows.length;
}

function shortAnswerRatio(accepted: readonly string[], answer: Answer): number {
  if (typeof answer !== "string") return 0;
  const given = normalizeAnswer(answer);
  return accepted.some((text) => normalizeAnswer(text) === given) ? 1 : 0;
}

/** The share of a question's points the answer earns, between 0 and 1. */
function ratio(presented: PresentedQuestion, answer: Answer): number {
  const { question } = presented;
  switch (question.kind) {
    case "single_choice":
      return typeof answer === "string" &&
        idOf(presented.options, answer) === question.correctOptionId
        ? 1
        : 0;
    case "multiple_choice":
      return multipleChoiceRatio(presented, answer);
    case "true_false":
      return answer === question.answer ? 1 : 0;
    case "short_answer":
      return shortAnswerRatio(question.acceptedAnswers, answer);
    case "ordering":
      return orderingRatio(presented, answer);
    case "matching":
      return matchingRatio(presented, answer);
  }
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Grades an attempt with the full definition, on the server only (spec 07):
 * `score = points earned / points possible`. Answers are read against the
 * attempt's presentation; unknown values and unanswered questions earn 0.
 */
export function gradeQuiz(presentation: QuizPresentation, answers: QuizAnswers): QuizGrade {
  const questions = presentation.questions.map((presented) => ({
    questionId: presented.question.id,
    name: presented.name,
    earned: round(ratio(presented, answers[presented.name]) * presented.question.points),
    possible: presented.question.points,
  }));
  const pointsEarned = round(questions.reduce((total, q) => total + q.earned, 0));
  const pointsPossible = questions.reduce((total, q) => total + q.possible, 0);
  return { pointsEarned, pointsPossible, score: round(pointsEarned / pointsPossible), questions };
}

/** `passed = score ≥ passing score`, tolerant of floating-point noise in sums of fractions. */
export function isPassing(score: number, passingScore: number): boolean {
  return score + 1e-9 >= passingScore;
}

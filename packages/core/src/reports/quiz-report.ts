import type { LearnerId } from "../content/ids.js";
import type { QuizAttempt } from "../ports/quiz-storage.types.js";
import type { QuizDefinition } from "../quiz/quiz.schemas.js";

export type QuizLearnerResult = {
  readonly learnerId: LearnerId;
  readonly attempts: number;
  readonly bestScore: number;
  readonly passed: boolean;
  readonly lastAttemptAt: Date;
};

export type QuizQuestionStats = {
  readonly questionId: string;
  readonly prompt: string;
  /** Closed attempts that graded this question. */
  readonly answered: number;
  /** Share of those attempts that earned every point; null when nobody answered. */
  readonly correctRate: number | null;
};

export type QuizReport = {
  readonly learners: number;
  readonly attempts: number;
  /** Learners who passed at least once, over learners with an attempt; null without learners. */
  readonly passRate: number | null;
  /** Mean score of every closed attempt; null without attempts. */
  readonly averageScore: number | null;
  readonly averageAttempts: number | null;
  /** Sorted by learner id. */
  readonly perLearner: readonly QuizLearnerResult[];
  readonly questions: readonly QuizQuestionStats[];
};

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const ratio = (part: number, whole: number) => (whole === 0 ? null : round(part / whole));

function merge(previous: QuizLearnerResult | undefined, attempt: QuizAttempt): QuizLearnerResult {
  const closedAt = attempt.closedAt ?? attempt.startedAt;
  const score = attempt.score ?? 0;
  if (previous === undefined) {
    return {
      learnerId: attempt.learnerId,
      attempts: 1,
      bestScore: score,
      passed: attempt.passed === true,
      lastAttemptAt: closedAt,
    };
  }
  return {
    learnerId: attempt.learnerId,
    attempts: previous.attempts + 1,
    bestScore: Math.max(previous.bestScore, score),
    passed: previous.passed || attempt.passed === true,
    lastAttemptAt: previous.lastAttemptAt > closedAt ? previous.lastAttemptAt : closedAt,
  };
}

function byLearner(attempts: readonly QuizAttempt[]): QuizLearnerResult[] {
  const results = new Map<LearnerId, QuizLearnerResult>();
  for (const attempt of attempts) {
    results.set(attempt.learnerId, merge(results.get(attempt.learnerId), attempt));
  }
  return [...results.values()].sort((a, b) => a.learnerId.localeCompare(b.learnerId));
}

/**
 * Question stats follow the current definition; results of questions removed
 * since are ignored. Historical scores are never recomputed (PROJECT.md).
 */
function questionStats(
  attempts: readonly QuizAttempt[],
  definition: QuizDefinition,
): QuizQuestionStats[] {
  return definition.questions.map((question) => {
    const results = attempts.flatMap((attempt) =>
      (attempt.questionResults ?? []).filter((result) => result.questionId === question.id),
    );
    const correct = results.filter((result) => result.earned >= result.possible).length;
    return {
      questionId: question.id,
      prompt: question.prompt,
      answered: results.length,
      correctRate: ratio(correct, results.length),
    };
  });
}

/** Quiz reporting of spec 07: only submitted and expired attempts count, never voided ones. */
export function summarizeQuizAttempts(
  input: readonly QuizAttempt[],
  definition: QuizDefinition,
): QuizReport {
  const attempts = input.filter((a) => a.status === "submitted" || a.status === "expired");
  const perLearner = byLearner(attempts);
  const totalScore = attempts.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0);
  return {
    learners: perLearner.length,
    attempts: attempts.length,
    passRate: ratio(perLearner.filter((learner) => learner.passed).length, perLearner.length),
    averageScore: ratio(totalScore, attempts.length),
    averageAttempts: ratio(attempts.length, perLearner.length),
    perLearner,
    questions: questionStats(attempts, definition),
  };
}

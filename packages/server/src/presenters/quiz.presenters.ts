import { attemptsRemaining, cooldownEndsAt, isPastDeadline } from "@bebranded/elearning-core";
import type {
  ApiLessonQuiz,
  ApiOpenQuizAttempt,
  ApiQuizAttempt,
  ApiQuizCorrection,
  ApiQuizResult,
  LessonProgressStatus,
  QuizAttempt,
  QuizCorrection,
  QuizLessonSettings,
  QuizStanding,
  SurveyJson,
} from "@bebranded/elearning-core";

import type { LessonQuiz } from "../services/quiz.js";

const iso = (date: Date | null) => (date === null ? null : date.toISOString());
const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** When the next attempt can open; null when it can open now. */
function nextAttemptAt(standing: QuizStanding, settings: QuizLessonSettings, now: Date) {
  const endsAt = cooldownEndsAt(standing, settings);
  return endsAt !== null && endsAt.getTime() > now.getTime() ? endsAt.toISOString() : null;
}

function presentOpenAttempt(attempt: QuizAttempt): ApiOpenQuizAttempt {
  return {
    id: attempt.id,
    started_at: attempt.startedAt.toISOString(),
    expires_at: iso(attempt.expiresAt),
  };
}

/** The quiz block of `GET /lessons/:id`: rules and standing only, never a question. */
export function presentLessonQuiz(
  { quiz, standing, settings }: LessonQuiz,
  now: Date,
): ApiLessonQuiz {
  const open = standing.openAttempt;
  // An open attempt past its deadline or on an older version is closed when the next one opens.
  const resumable =
    open !== null && open.quizVersion === quiz?.version && !isPastDeadline(open.expiresAt, now);
  return {
    ready: quiz !== null,
    question_count: quiz?.definition.questions.length ?? 0,
    passing_score: settings.passingScore,
    max_attempts: settings.maxAttempts,
    attempts_used: standing.closedAttempts,
    attempts_remaining: attemptsRemaining(standing, settings),
    cooldown_minutes: settings.cooldownMinutes,
    next_attempt_at: nextAttemptAt(standing, settings, now),
    time_limit_minutes: settings.timeLimitMinutes,
    best_score: standing.bestScore,
    passed: standing.passed,
    show_correction: settings.showCorrection,
    open_attempt: resumable ? presentOpenAttempt(open) : null,
  };
}

export function presentQuizAttempt(attempt: QuizAttempt, survey: SurveyJson): ApiQuizAttempt {
  return { ...presentOpenAttempt(attempt), attempt_number: attempt.attemptNumber, survey };
}

function presentCorrection(correction: QuizCorrection): ApiQuizCorrection {
  return {
    name: correction.name,
    correct: correction.correct,
    earned: correction.earned,
    possible: correction.possible,
    correct_answer: correction.correctAnswer,
    explanation: correction.explanation,
  };
}

export type QuizResultInput = {
  readonly attempt: QuizAttempt;
  readonly status: LessonProgressStatus;
  readonly standing: QuizStanding;
  readonly settings: QuizLessonSettings;
  readonly corrections: readonly QuizCorrection[] | null;
  readonly now: Date;
};

export function presentQuizResult(input: QuizResultInput): ApiQuizResult {
  const { attempt, standing, settings } = input;
  const results = attempt.questionResults ?? [];
  return {
    attempt_id: attempt.id,
    attempt_number: attempt.attemptNumber,
    outcome: attempt.status === "expired" ? "expired" : "graded",
    score: attempt.score ?? 0,
    passed: attempt.passed ?? false,
    points_earned: round(results.reduce((total, result) => total + result.earned, 0)),
    points_possible: results.reduce((total, result) => total + result.possible, 0),
    status: input.status,
    best_score: standing.bestScore ?? 0,
    attempts_remaining: attemptsRemaining(standing, settings),
    next_attempt_at: nextAttemptAt(standing, settings, input.now),
    corrections: input.corrections === null ? null : input.corrections.map(presentCorrection),
  };
}

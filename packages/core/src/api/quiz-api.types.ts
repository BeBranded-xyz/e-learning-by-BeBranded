import type { LessonProgressStatus } from "../progress/progress.js";
import type { ShowCorrection } from "../quiz/quiz.schemas.js";
import type { SurveyJson } from "../quiz/survey.js";

/** Quiz bodies of the learner API (spec 04, section 8; spec 07). */

export type ApiOpenQuizAttempt = {
  readonly id: string;
  readonly started_at: string;
  /** Null without a time limit. */
  readonly expires_at: string | null;
};

/** The quiz of a lesson, as `GET /lessons/:id` returns it: rules and the learner's standing. */
export type ApiLessonQuiz = {
  /** False until an admin has saved questions; the lesson cannot be published before. */
  readonly ready: boolean;
  readonly question_count: number;
  readonly passing_score: number;
  /** Null for unlimited attempts. */
  readonly max_attempts: number | null;
  readonly attempts_used: number;
  readonly attempts_remaining: number | null;
  readonly cooldown_minutes: number;
  /** When the cooldown after the last attempt ends; null when a new attempt can open now. */
  readonly next_attempt_at: string | null;
  readonly time_limit_minutes: number | null;
  /** Best score so far, between 0 and 1; null before the first graded attempt. */
  readonly best_score: number | null;
  readonly passed: boolean;
  readonly show_correction: ShowCorrection;
  /** An attempt opened and not submitted yet; opening again resumes it. */
  readonly open_attempt: ApiOpenQuizAttempt | null;
};

/** Answer to `POST /lessons/:id/quiz/attempts`. */
export type ApiQuizAttempt = ApiOpenQuizAttempt & {
  readonly attempt_number: number;
  /** SurveyJS JSON without answers, explanations or points. */
  readonly survey: SurveyJson;
};

export type ApiQuizCorrection = {
  readonly name: string;
  readonly correct: boolean;
  readonly earned: number;
  readonly possible: number;
  readonly correct_answer: string | boolean | readonly string[] | Readonly<Record<string, string>>;
  readonly explanation: string;
};

/** Answer to `POST /lessons/:id/quiz/attempts/:attemptId/submit`. */
export type ApiQuizResult = {
  readonly attempt_id: string;
  readonly attempt_number: number;
  /** `expired` when submitted after the time limit: the attempt scores 0. */
  readonly outcome: "graded" | "expired";
  readonly score: number;
  readonly passed: boolean;
  readonly points_earned: number;
  readonly points_possible: number;
  /** The lesson's status after this attempt. */
  readonly status: LessonProgressStatus;
  readonly best_score: number;
  readonly attempts_remaining: number | null;
  readonly next_attempt_at: string | null;
  /** Null unless the quiz settings show corrections for this attempt. */
  readonly corrections: readonly ApiQuizCorrection[] | null;
};

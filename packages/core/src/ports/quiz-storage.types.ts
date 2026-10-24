import type { AttemptGrantId, LearnerId, LessonId, QuizAttemptId, QuizId } from "../content/ids.js";
import type { AttemptHistory } from "../quiz/attempts.js";
import type { QuestionResult } from "../quiz/grade.js";
import type { QuizAnswers, QuizDefinition } from "../quiz/quiz.schemas.js";
import type { JsonValue, TenantScope } from "./storage.types.js";

export type Quiz = {
  readonly id: QuizId;
  readonly lessonId: LessonId;
  /** The quiz editor's BlockNote document, as saved. */
  readonly editorDocument: JsonValue;
  /** Derived from the document; holds the answers, never sent to learners. */
  readonly definition: QuizDefinition;
  /** SHA-256 (hex) of the definition. */
  readonly version: string;
};

export type QuizAttemptStatus = "open" | "submitted" | "expired" | "voided";

export type QuizAttempt = {
  readonly id: QuizAttemptId;
  readonly quizId: QuizId;
  readonly lessonId: LessonId;
  readonly learnerId: LearnerId;
  readonly attemptNumber: number;
  readonly status: QuizAttemptStatus;
  readonly quizVersion: string;
  /** Unsigned 32-bit seed of the attempt's presentation. */
  readonly seed: number;
  /** The lesson's shuffling options when the attempt opened; grading rebuilds the same order. */
  readonly shuffleQuestions: boolean;
  readonly shuffleOptions: boolean;
  readonly startedAt: Date;
  readonly expiresAt: Date | null;
  /** Null while open. */
  readonly closedAt: Date | null;
  readonly answers: QuizAnswers | null;
  readonly questionResults: readonly QuestionResult[] | null;
  /** Between 0 and 1; null while open or voided. */
  readonly score: number | null;
  readonly passed: boolean | null;
};

/** Extra attempts an admin granted one learner on one quiz lesson (spec 07, "Attempts"). */
export type QuizAttemptGrant = {
  readonly id: AttemptGrantId;
  readonly lessonId: LessonId;
  readonly learnerId: LearnerId;
  readonly extraAttempts: number;
  readonly grantedBy: LearnerId;
  readonly createdAt: Date;
};

/** A learner's standing on a quiz, aggregated by the storage; `extraAttempts` sums their grants. */
export type QuizStanding = AttemptHistory & {
  readonly bestScore: number | null;
  readonly passed: boolean;
  readonly openAttempt: QuizAttempt | null;
};

export type QuizStorageReads = {
  findQuiz(scope: TenantScope, lessonId: LessonId): Promise<Quiz | null>;
  findQuizStanding(
    scope: TenantScope,
    learnerId: LearnerId,
    lessonId: LessonId,
  ): Promise<QuizStanding>;
  /** Learners of the tenant with at least one closed attempt (the edit warning of spec 07). */
  countQuizLearners(scope: TenantScope, lessonId: LessonId): Promise<number>;
  /** The tenant's grants on a lesson, oldest first; only one learner's with `learnerId`. */
  listQuizAttemptGrants(
    scope: TenantScope,
    lessonId: LessonId,
    learnerId?: LearnerId,
  ): Promise<QuizAttemptGrant[]>;
};

export type QuizStorageWrites = {
  /**
   * Creates or replaces the quiz of a lesson the tenant owns, keeping its id.
   * False when the lesson does not exist or belongs to another tenant.
   */
  saveQuiz(scope: TenantScope, quiz: Quiz): Promise<boolean>;
  /** False when the lesson was not started by the learner. */
  insertQuizAttempt(scope: TenantScope, attempt: QuizAttempt): Promise<boolean>;
  /** The learner's attempt, locked until the transaction ends; null when it is not theirs. */
  lockQuizAttempt(
    scope: TenantScope,
    learnerId: LearnerId,
    attemptId: QuizAttemptId,
  ): Promise<QuizAttempt | null>;
  /** Writes the closing fields of an attempt (status, closed_at, answers, results, score). */
  closeQuizAttempt(scope: TenantScope, attempt: QuizAttempt): Promise<void>;
  /** Appends a grant for the scope's tenant; grants are never edited. */
  insertQuizAttemptGrant(scope: TenantScope, grant: QuizAttemptGrant): Promise<void>;
};

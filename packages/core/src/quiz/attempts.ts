import type { QuizLessonSettings } from "./quiz.schemas.js";

/** Network slack on the time limit: a submission this late after the deadline still counts. */
export const QUIZ_TIMING = { submissionGraceSeconds: 30 } as const;

/**
 * The attempts that count against `maxAttempts` (submitted or expired, never
 * voided), and the extra attempts admins granted the learner (spec 07).
 */
export type AttemptHistory = {
  readonly closedAttempts: number;
  readonly lastClosedAt: Date | null;
  readonly extraAttempts: number;
};

export type Eligibility =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "attempts_exhausted" }
  | { readonly ok: false; readonly code: "cooldown"; readonly nextAttemptAt: Date };

type AttemptRules = Pick<QuizLessonSettings, "maxAttempts" | "cooldownMinutes">;

/** Null for unlimited attempts. Granted attempts add to the lesson's maximum. */
export function attemptsRemaining(history: AttemptHistory, rules: AttemptRules): number | null {
  if (rules.maxAttempts === null) return null;
  return Math.max(0, rules.maxAttempts + history.extraAttempts - history.closedAttempts);
}

/** When the cooldown after the last attempt ends; null when there is none to wait for. */
export function cooldownEndsAt(history: AttemptHistory, rules: AttemptRules): Date | null {
  if (history.lastClosedAt === null || rules.cooldownMinutes === 0) return null;
  return new Date(history.lastClosedAt.getTime() + rules.cooldownMinutes * 60_000);
}

/** Whether a new attempt may open now (spec 07, "Attempts"). */
export function attemptEligibility(
  history: AttemptHistory,
  rules: AttemptRules,
  now: Date,
): Eligibility {
  if (attemptsRemaining(history, rules) === 0) return { ok: false, code: "attempts_exhausted" };
  const endsAt = cooldownEndsAt(history, rules);
  if (endsAt !== null && endsAt.getTime() > now.getTime()) {
    return { ok: false, code: "cooldown", nextAttemptAt: endsAt };
  }
  return { ok: true };
}

/** The deadline of an attempt opened at `startedAt`; null without a time limit. */
export function attemptExpiresAt(
  startedAt: Date,
  rules: Pick<QuizLessonSettings, "timeLimitMinutes">,
): Date | null {
  if (rules.timeLimitMinutes === null) return null;
  return new Date(startedAt.getTime() + rules.timeLimitMinutes * 60_000);
}

/** Past the deadline and its grace period: the attempt expires with a score of 0. */
export function isPastDeadline(expiresAt: Date | null, at: Date): boolean {
  if (expiresAt === null) return false;
  return at.getTime() > expiresAt.getTime() + QUIZ_TIMING.submissionGraceSeconds * 1000;
}

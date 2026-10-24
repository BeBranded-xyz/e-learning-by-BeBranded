"use client";

import type { ApiLessonQuiz } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { useUi } from "../ui/kit.js";

export type QuizIntroProps = {
  readonly quiz: ApiLessonQuiz;
  readonly onStart: () => void;
  readonly starting: boolean;
  /** Why the last attempt could not open, already translated. */
  readonly notice: string | null;
};

function useRules(quiz: ApiLessonQuiz): string[] {
  const { i18n } = useElearning();
  const rules = [i18n.t("quiz.rules.pass", { percent: i18n.formatPercent(quiz.passing_score) })];
  rules.push(
    quiz.max_attempts === null
      ? i18n.t("quiz.rules.unlimited")
      : i18n.t("quiz.rules.attempts", {
          remaining: quiz.attempts_remaining ?? 0,
          max: quiz.max_attempts,
        }),
  );
  if (quiz.time_limit_minutes !== null) {
    rules.push(i18n.t("quiz.rules.timeLimit", { minutes: quiz.time_limit_minutes }));
  }
  return rules;
}

/** The quiz before an attempt: its rules, the learner's standing, and the way in. */
export function QuizIntro({ quiz, onStart, starting, notice }: QuizIntroProps) {
  const { i18n } = useElearning();
  const { Button } = useUi();
  const rules = useRules(quiz);
  const exhausted = quiz.attempts_remaining === 0;
  const waiting = quiz.next_attempt_at !== null;
  const blocked = exhausted
    ? i18n.t("quiz.exhausted")
    : waiting
      ? i18n.t("quiz.cooldown", { date: i18n.formatDateTime(quiz.next_attempt_at) })
      : null;
  return (
    <section className="el-quiz-intro" aria-label={i18n.t("quiz.start")}>
      <ul className="el-quiz-rules">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      {quiz.passed ? <p className="el-quiz-passed">{i18n.t("quiz.passed")}</p> : null}
      {quiz.best_score === null ? null : (
        <p className="el-meta">
          {i18n.t("quiz.best", { percent: i18n.formatPercent(quiz.best_score) })}
        </p>
      )}
      <p role="status" aria-live="polite" className="el-quiz-notice">
        {notice ?? blocked}
      </p>
      {blocked === null ? (
        <Button variant="primary" onClick={onStart} disabled={starting}>
          {i18n.t(quiz.open_attempt === null ? "quiz.start" : "quiz.resume")}
        </Button>
      ) : null}
    </section>
  );
}

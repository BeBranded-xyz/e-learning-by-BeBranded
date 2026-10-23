"use client";

import type { ApiQuizAttempt, ApiQuizResult } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { correctionViews } from "../quiz/corrections.js";

export type QuizResultProps = {
  readonly attempt: ApiQuizAttempt;
  readonly result: ApiQuizResult;
  readonly onRetry: (() => void) | null;
};

function Corrections({ attempt, result }: Omit<QuizResultProps, "onRetry">) {
  const { i18n } = useElearning();
  if (result.corrections === null) return null;
  const views = correctionViews(attempt.survey, result.corrections, {
    yes: i18n.t("quiz.true"),
    no: i18n.t("quiz.false"),
  });
  return (
    <section className="el-quiz-corrections" aria-label={i18n.t("quiz.correction.title")}>
      <h2>{i18n.t("quiz.correction.title")}</h2>
      <ol>
        {views.map((view) => (
          <li key={view.name} className="el-quiz-correction" data-correct={view.correct}>
            <p className="el-quiz-correction-title">{view.title}</p>
            <p>
              {i18n.t(view.correct ? "quiz.correction.correct" : "quiz.correction.incorrect")}
              {" · "}
              {i18n.t("quiz.correction.answer", { answer: view.answer })}
            </p>
            {view.explanation === "" ? null : <p className="el-meta">{view.explanation}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The graded attempt: score, outcome and, when the lesson allows it, the corrections. */
export function QuizResult({ attempt, result, onRetry }: QuizResultProps) {
  const { i18n } = useElearning();
  const percent = i18n.formatPercent(result.score);
  return (
    <section className="el-quiz-result" data-passed={result.passed}>
      <p role="status" aria-live="polite" className="el-quiz-score">
        {i18n.t(result.passed ? "quiz.result.passed" : "quiz.result.failed", { percent })}
      </p>
      {result.outcome === "expired" ? (
        <p className="el-meta">{i18n.t("quiz.result.expired")}</p>
      ) : null}
      <p className="el-meta">
        {i18n.t("quiz.result.points", {
          earned: result.points_earned,
          possible: result.points_possible,
        })}
      </p>
      <Corrections attempt={attempt} result={result} />
      {onRetry === null ? null : (
        <button type="button" className="el-button" onClick={onRetry}>
          {i18n.t("quiz.retry")}
        </button>
      )}
    </section>
  );
}

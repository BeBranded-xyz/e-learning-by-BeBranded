"use client";

import type { ApiQuizReport } from "@bebranded/elearning-core";
import { QueryState } from "@bebranded/elearning-react";

import { useQuizReport } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { AttemptGrants } from "./AttemptGrants.js";
import { CsvLink, StatList } from "./ReportSummary.js";

function QuestionTable({ report }: { readonly report: ApiQuizReport }) {
  const { t } = useAdmin();
  return (
    <table className="el-admin-table">
      <caption>{t.t("quizReport.questions")}</caption>
      <thead>
        <tr>
          <th scope="col">{t.t("quizReport.question")}</th>
          <th scope="col">{t.t("quizReport.answered")}</th>
          <th scope="col">{t.t("quizReport.correctRate")}</th>
        </tr>
      </thead>
      <tbody>
        {report.questions.map((question) => (
          <tr key={question.question_id}>
            <th scope="row">{question.prompt}</th>
            <td>{question.answered}</td>
            <td>{question.correct_rate === null ? "–" : t.formatPercent(question.correct_rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LearnerTable({ report }: { readonly report: ApiQuizReport }) {
  const { t } = useAdmin();
  return (
    <table className="el-admin-table">
      <caption>{t.t("quizReport.learners")}</caption>
      <thead>
        <tr>
          {(
            [
              "report.learner",
              "quizReport.attempts",
              "quizReport.bestScore",
              "quizReport.passed",
              "quizReport.lastAttempt",
            ] as const
          ).map((column) => (
            <th key={column} scope="col">
              {t.t(column)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {report.learners_results.map((learner) => (
          <tr key={learner.learner_id}>
            <th scope="row">{learner.learner_id}</th>
            <td>{learner.attempts}</td>
            <td>{t.formatPercent(learner.best_score)}</td>
            <td>{learner.passed ? t.t("quizReport.yes") : t.t("quizReport.no")}</td>
            <td>{t.formatDate(learner.last_attempt_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const ratio = (value: number | null, format: (ratio: number) => string) =>
  value === null ? "–" : format(value);

/** Quiz reporting (spec 07, "Reporting"): rates, per-question analysis, results, extra attempts. */
export function QuizReport({ lessonId }: { readonly lessonId: string }) {
  const { t } = useAdmin();
  const report = useQuizReport(lessonId);
  if (report.isPending) return <QueryState kind="loading" />;
  if (report.isError)
    return <QueryState kind="error" error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const stats = [
    { label: t.t("quizReport.learners"), value: String(data.learners) },
    { label: t.t("quizReport.attempts"), value: String(data.attempts) },
    { label: t.t("quizReport.passRate"), value: ratio(data.pass_rate, t.formatPercent) },
    { label: t.t("quizReport.averageScore"), value: ratio(data.average_score, t.formatPercent) },
    {
      label: t.t("quizReport.averageAttempts"),
      value: ratio(data.average_attempts, (value) => value.toFixed(1)),
    },
  ];
  return (
    <section className="el-admin-report" aria-labelledby="el-admin-quiz-report">
      <h3 id="el-admin-quiz-report">{t.t("quizReport.title")}</h3>
      <StatList stats={stats} />
      <CsvLink path={`quizzes/${encodeURIComponent(lessonId)}`} />
      <div className="el-table-wrapper">
        <QuestionTable report={data} />
      </div>
      {data.learners_results.length === 0 ? null : (
        <div className="el-table-wrapper">
          <LearnerTable report={data} />
        </div>
      )}
      <AttemptGrants lessonId={lessonId} />
    </section>
  );
}

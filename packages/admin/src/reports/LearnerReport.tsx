"use client";

import { QueryState } from "@bebranded/elearning-react";

import { useLearnerReport } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { EnrollmentTable } from "./EnrollmentTable.js";
import { CsvLink, ReportSummary } from "./ReportSummary.js";

export type LearnerReportProps = {
  readonly learnerId: string;
  readonly courseHref?: ((courseId: string) => string) | undefined;
};

/** One learner's training in the tenant: every enrollment, its progress and due date. */
export function LearnerReport({ learnerId, courseHref }: LearnerReportProps) {
  const { t } = useAdmin();
  const report = useLearnerReport(learnerId);
  if (report.isPending) return <QueryState kind="loading" />;
  if (report.isError)
    return <QueryState kind="error" error={report.error} onRetry={() => void report.refetch()} />;
  const { summary, data } = report.data;
  const title = t.t("report.learnerTitle", { id: learnerId });
  return (
    <section className="el-admin-report" aria-labelledby="el-admin-learner-report">
      <h2 id="el-admin-learner-report">{title}</h2>
      <ReportSummary summary={summary} />
      <CsvLink path={`learners/${encodeURIComponent(learnerId)}`} />
      {data.length === 0 ? (
        <p className="el-meta">{t.t("report.empty")}</p>
      ) : (
        <EnrollmentTable
          caption={title}
          rows={data}
          first={{
            header: t.t("report.course"),
            cell: (row) => {
              const label = row.course_title ?? row.course_id;
              return courseHref === undefined ? (
                label
              ) : (
                <a href={courseHref(row.course_id)}>{label}</a>
              );
            },
          }}
        />
      )}
    </section>
  );
}

"use client";

import { QueryState } from "@bebranded/elearning-react";

import { useCourseReport } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { EnrollmentTable } from "./EnrollmentTable.js";
import { CsvLink, ReportSummary } from "./ReportSummary.js";

export type CourseReportProps = {
  readonly courseId: string;
  /** The host's page of one learner's report; ids stay plain text without it. */
  readonly learnerHref?: ((learnerId: string) => string) | undefined;
};

/** Tracking of one course (spec 04, reports): who is enrolled, how far, and who is late. */
export function CourseReport({ courseId, learnerHref }: CourseReportProps) {
  const { t } = useAdmin();
  const report = useCourseReport(courseId);
  if (report.isPending) return <QueryState kind="loading" />;
  if (report.isError)
    return <QueryState kind="error" error={report.error} onRetry={() => void report.refetch()} />;
  const { course, summary, data } = report.data;
  return (
    <section className="el-admin-report" aria-labelledby="el-admin-course-report">
      <h3 id="el-admin-course-report">{t.t("report.title")}</h3>
      <ReportSummary summary={summary} />
      <CsvLink path={`courses/${encodeURIComponent(course.id)}`} />
      {data.length === 0 ? (
        <p className="el-meta">{t.t("report.empty")}</p>
      ) : (
        <EnrollmentTable
          caption={course.title}
          rows={data}
          first={{
            header: t.t("report.learner"),
            cell: (row) =>
              learnerHref === undefined ? (
                row.learner_id
              ) : (
                <a href={learnerHref(row.learner_id)}>{row.learner_id}</a>
              ),
          }}
        />
      )}
    </section>
  );
}

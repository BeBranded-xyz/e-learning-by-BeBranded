"use client";

import type { ApiEnrollmentReportRow } from "@bebranded/elearning-core";
import type { ReactNode } from "react";

import { useAdmin } from "../provider/admin-context.js";

export type EnrollmentTableProps<R extends ApiEnrollmentReportRow> = {
  readonly caption: string;
  readonly rows: readonly R[];
  /** The first column: the learner on a course report, the course on a learner report. */
  readonly first: { readonly header: string; readonly cell: (row: R) => ReactNode };
};

const COLUMNS = [
  "report.source",
  "report.dueAt",
  "report.startedAt",
  "report.completedAt",
  "report.progress",
] as const;

/** Enrollment rows of a report; dates in UTC, like the server stores them. */
export function EnrollmentTable<R extends ApiEnrollmentReportRow>({
  caption,
  rows,
  first,
}: EnrollmentTableProps<R>) {
  const { t } = useAdmin();
  const date = (iso: string | null) => (iso === null ? "–" : t.formatDate(iso));
  return (
    <div className="el-table-wrapper">
      <table className="el-admin-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{first.header}</th>
            {COLUMNS.map((column) => (
              <th key={column} scope="col">
                {t.t(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.learner_id}-${row.course_id}`} data-overdue={row.overdue}>
              <th scope="row">{first.cell(row)}</th>
              <td>{t.t(`source.${row.source}`)}</td>
              <td>
                {date(row.due_at)}
                {row.overdue ? (
                  <span className="el-tag el-admin-late"> {t.t("report.late")}</span>
                ) : null}
              </td>
              <td>{date(row.started_at)}</td>
              <td>{date(row.completed_at)}</td>
              <td>{t.formatPercent(row.progress)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

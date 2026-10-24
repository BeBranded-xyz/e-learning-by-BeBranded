"use client";

import type { ApiEnrollmentReportRow } from "@bebranded/elearning-core";
import { useUi } from "@bebranded/elearning-react";
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
  const { Badge, Table } = useUi();
  const date = (iso: string | null) => (iso === null ? "–" : t.formatDate(iso));
  return (
    <Table
      caption={caption}
      columns={[
        { key: "first", header: first.header },
        ...COLUMNS.map((column) => ({ key: column, header: t.t(column) })),
      ]}
      rows={rows.map((row) => ({
        key: `${row.learner_id}-${row.course_id}`,
        cells: [
          first.cell(row),
          t.t(`source.${row.source}`),
          <>
            {date(row.due_at)}
            {row.overdue ? <Badge tone="destructive"> {t.t("report.late")}</Badge> : null}
          </>,
          date(row.started_at),
          date(row.completed_at),
          t.formatPercent(row.progress),
        ],
      }))}
    />
  );
}

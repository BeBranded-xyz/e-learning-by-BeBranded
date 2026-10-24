"use client";

import type { ApiReportSummary } from "@bebranded/elearning-core";
import { useUi } from "@bebranded/elearning-react";

import { useAdmin } from "../provider/admin-context.js";

export type Stat = { readonly label: string; readonly value: string };

/** Key figures as a description list: each figure keeps its label for screen readers. */
export function StatList({ stats }: { readonly stats: readonly Stat[] }) {
  return (
    <dl className="el-admin-stats">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReportSummary({ summary }: { readonly summary: ApiReportSummary }) {
  const { t } = useAdmin();
  const average = summary.average_progress;
  return (
    <StatList
      stats={[
        { label: t.t("report.enrolled"), value: String(summary.enrolled) },
        { label: t.t("report.started"), value: String(summary.started) },
        { label: t.t("report.completed"), value: String(summary.completed) },
        { label: t.t("report.overdue"), value: String(summary.overdue) },
        {
          label: t.t("report.averageProgress"),
          value: average === null ? "–" : t.formatPercent(average),
        },
      ]}
    />
  );
}

/** The CSV of a report, downloaded by the browser with the host's cookies. */
export function CsvLink({ path }: { readonly path: string }) {
  const { admin, t } = useAdmin();
  const { LinkButton } = useUi();
  return (
    <LinkButton href={admin.reportCsvUrl(path)} download>
      {t.t("action.download")}
    </LinkButton>
  );
}

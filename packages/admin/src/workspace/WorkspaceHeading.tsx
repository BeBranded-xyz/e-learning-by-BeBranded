"use client";

import { useUi } from "@bebranded/elearning-react";
import { useAdmin } from "../provider/admin-context.js";

export function WorkspaceHeading({
  id,
  title,
  subtitle,
  status,
}: {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly status: "draft" | "published" | "archived";
}) {
  const { Badge } = useUi();
  const { t } = useAdmin();
  return (
    <header className="el-author-heading">
      <div>
        <p className="el-meta">{subtitle}</p>
        <h2 id={id}>{title}</h2>
      </div>
      <Badge data-status={status}>{t.t(`status.${status}`)}</Badge>
    </header>
  );
}

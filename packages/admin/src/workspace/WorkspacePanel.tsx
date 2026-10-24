import type { ReactNode } from "react";

/** Linked panels stay mounted so changing tabs does not discard an author's draft. */
export function WorkspacePanel({
  scope,
  section,
  active,
  children,
}: {
  readonly scope: string;
  readonly section: string;
  readonly active: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      className="el-author-panel"
      data-section={section}
      id={`${scope}-panel-${section}`}
      role="tabpanel"
      aria-labelledby={`${scope}-tab-${section}`}
      hidden={active !== section}
    >
      {children}
    </div>
  );
}

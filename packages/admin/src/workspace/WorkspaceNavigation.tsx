"use client";

import { useUi } from "@bebranded/elearning-react";
import { useAdmin } from "../provider/admin-context.js";

export const COURSE_SECTIONS = [
  "structure",
  "settings",
  "completion",
  "access",
  "tracking",
  "preview",
] as const;
export type CourseSection = (typeof COURSE_SECTIONS)[number];
export const LESSON_SECTIONS = ["content", "settings", "completion", "access", "preview"] as const;
export type LessonSection = (typeof LESSON_SECTIONS)[number];

export function WorkspaceNavigation<T extends CourseSection | LessonSection>({
  sections,
  active,
  onChange,
}: {
  readonly sections: readonly T[];
  readonly active: T;
  readonly onChange: (section: T) => void;
}) {
  const { Button } = useUi();
  const { t } = useAdmin();
  return (
    <nav className="el-author-sections" aria-label={t.t("workspace.navigation")}>
      {sections.map((section) => (
        <Button
          key={section}
          variant={section === active ? "primary" : "ghost"}
          aria-current={section === active ? "page" : undefined}
          onClick={() => {
            onChange(section);
          }}
        >
          {t.t(`workspace.${section}`)}
        </Button>
      ))}
    </nav>
  );
}

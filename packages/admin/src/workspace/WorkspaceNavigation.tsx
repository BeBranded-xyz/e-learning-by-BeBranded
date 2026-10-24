"use client";

import type { KeyboardEvent } from "react";
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

function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
  const tabs = Array.from(
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
  );
  const index = tabs.indexOf(event.currentTarget);
  const direction = event.currentTarget.closest('[dir="rtl"]') ? -1 : 1;
  const positions: Record<string, number> = {
    ArrowRight: index + direction,
    ArrowLeft: index - direction,
    Home: 0,
    End: tabs.length - 1,
  };
  const next = positions[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const tab = tabs[(next + tabs.length) % tabs.length];
  tab?.focus();
  tab?.click();
}

export function WorkspaceNavigation<T extends CourseSection | LessonSection>({
  sections,
  active,
  onChange,
  scope,
}: {
  readonly sections: readonly T[];
  readonly active: T;
  readonly scope: string;
  readonly onChange: (section: T) => void;
}) {
  const { Button } = useUi();
  const { t } = useAdmin();
  return (
    <div className="el-author-sections" role="tablist" aria-label={t.t("workspace.navigation")}>
      {sections.map((section) => (
        <span className="el-author-tab" data-active={section === active} key={section}>
          <Button
            id={`${scope}-tab-${section}`}
            variant="ghost"
            role="tab"
            aria-selected={section === active}
            aria-controls={`${scope}-panel-${section}`}
            tabIndex={section === active ? 0 : -1}
            onKeyDown={navigateTabs}
            onClick={() => {
              onChange(section);
            }}
          >
            {t.t(`workspace.${section}`)}
          </Button>
        </span>
      ))}
    </div>
  );
}

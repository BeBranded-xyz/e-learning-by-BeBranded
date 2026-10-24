"use client";

import type { ApiCourseLesson } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { useUi } from "../ui/kit.js";

const TONES = { not_started: "neutral", in_progress: "info", completed: "success" } as const;

/** Status as text, never as color alone (WCAG 1.4.1). */
export function LessonStatus({ status }: { readonly status: ApiCourseLesson["status"] }) {
  const { i18n } = useElearning();
  const { Badge } = useUi();
  return (
    <Badge tone={TONES[status]} data-status={status}>
      {i18n.t(`lesson.status.${status}`)}
    </Badge>
  );
}

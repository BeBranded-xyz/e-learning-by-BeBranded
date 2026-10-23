"use client";

import type { ApiCourseLesson } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";

/** Status as text, never as color alone (WCAG 1.4.1). */
export function LessonStatus({ status }: { readonly status: ApiCourseLesson["status"] }) {
  const { i18n } = useElearning();
  return (
    <span className="el-status" data-status={status}>
      {i18n.t(`lesson.status.${status}`)}
    </span>
  );
}

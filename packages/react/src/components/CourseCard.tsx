"use client";

import type { ApiCourseSummary } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { ProgressBar } from "./ProgressBar.js";

export type CourseCardProps = { readonly course: ApiCourseSummary; readonly href: string };

export function CourseCard({ course, href }: CourseCardProps) {
  const { i18n } = useElearning();
  const { enrollment } = course;
  return (
    <article className="el-card">
      <h3 className="el-card-title">
        <a href={href}>{course.title}</a>
      </h3>
      {course.summary === null ? null : <p className="el-card-summary">{course.summary}</p>}
      {enrollment === null ? null : (
        <>
          <ProgressBar
            ratio={enrollment.progress}
            label={`${i18n.t("progress.label")}: ${course.title}`}
          />
          {enrollment.due_at === null ? null : (
            <p className="el-card-due">
              {i18n.t("myTraining.due", { date: i18n.formatDate(enrollment.due_at) })}
            </p>
          )}
        </>
      )}
    </article>
  );
}

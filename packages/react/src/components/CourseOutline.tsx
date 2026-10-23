"use client";

import type { ApiCourse, ApiCourseLesson } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { LessonStatus } from "./LessonStatus.js";
import { ProgressBar } from "./ProgressBar.js";

export type CourseOutlineProps = {
  readonly course: ApiCourse;
  readonly lessonHref: (lesson: ApiCourseLesson) => string;
  /** Shown for self-enroll courses the learner has not joined yet. */
  readonly onEnroll?: () => void;
  readonly enrolling?: boolean;
};

function LessonItem({ lesson, href }: { readonly lesson: ApiCourseLesson; readonly href: string }) {
  const { i18n } = useElearning();
  return (
    <li className="el-outline-lesson">
      <a href={href}>{lesson.title}</a>
      <LessonStatus status={lesson.status} />
      {lesson.is_required ? null : <span className="el-tag">{i18n.t("lesson.optional")}</span>}
      {lesson.estimated_minutes === null ? null : (
        <span className="el-meta">
          {i18n.t("lesson.minutes", { minutes: lesson.estimated_minutes })}
        </span>
      )}
    </li>
  );
}

/** The course page: title, progress, enrollment and the chapters › lessons tree. */
export function CourseOutline({
  course,
  lessonHref,
  onEnroll,
  enrolling = false,
}: CourseOutlineProps) {
  const { i18n } = useElearning();
  const { progress } = course;
  const canEnroll =
    course.enrollment === null && course.enrollment_mode === "self" && onEnroll !== undefined;
  return (
    <article className="el-course">
      <header className="el-course-header">
        <h1>{course.title}</h1>
        {course.summary === null ? null : <p>{course.summary}</p>}
        <ProgressBar ratio={progress.ratio} />
        <p className="el-meta">
          {progress.is_complete
            ? i18n.t("course.completed")
            : i18n.t("course.progress", {
                completed: progress.completed_required,
                total: progress.total_required,
              })}
        </p>
        {canEnroll ? (
          <button
            type="button"
            className="el-button el-button-primary"
            onClick={onEnroll}
            disabled={enrolling}
          >
            {i18n.t("course.enroll")}
          </button>
        ) : null}
      </header>
      {course.chapters.map((chapter) => (
        <section key={chapter.id} className="el-outline-chapter" aria-label={chapter.title}>
          <h2>{chapter.title}</h2>
          <ol className="el-outline-lessons">
            {chapter.lessons.map((lesson) => (
              <LessonItem key={lesson.id} lesson={lesson} href={lessonHref(lesson)} />
            ))}
          </ol>
        </section>
      ))}
    </article>
  );
}

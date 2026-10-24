"use client";

import { QueryState } from "@bebranded/elearning-react";
import type { ApiAdminCourse } from "@bebranded/elearning-core";

import { CourseCreateForm } from "../components/CourseCreateForm.js";
import { useAdminCourses } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";

export type CourseAdminListProps = {
  /** The host's back-office page of a course. */
  readonly courseHref: (course: ApiAdminCourse) => string;
  readonly onCreated?: ((course: ApiAdminCourse) => void) | undefined;
};

/** Every course the admin can manage, plus the shared catalog read only, and a creation form. */
export function CourseAdminList({ courseHref, onCreated }: CourseAdminListProps) {
  const { t } = useAdmin();
  const courses = useAdminCourses();
  if (courses.isPending) return <QueryState kind="loading" />;
  if (courses.isError) {
    return <QueryState kind="error" error={courses.error} onRetry={() => void courses.refetch()} />;
  }
  const list = courses.data.data;
  return (
    <section className="el-admin-courses" aria-labelledby="el-admin-courses-title">
      <h2 id="el-admin-courses-title">{t.t("courses.title")}</h2>
      {list.length === 0 ? <p className="el-meta">{t.t("courses.empty")}</p> : null}
      <ul className="el-admin-list">
        {list.map((course) => (
          <li key={course.id}>
            <a href={courseHref(course)} aria-label={t.t("courses.open", { title: course.title })}>
              {course.title}
            </a>
            <span className="el-tag" data-status={course.status}>
              {t.t(`status.${course.status}`)}
            </span>
            {course.editable ? null : <span className="el-tag">{t.t("courses.shared")}</span>}
          </li>
        ))}
      </ul>
      <CourseCreateForm onCreated={onCreated} />
    </section>
  );
}

"use client";

import { useState } from "react";
import { TextField } from "../components/Fields.js";
import { QueryState, useUi } from "@bebranded/elearning-react";
import type { ApiAdminCourse } from "@bebranded/elearning-core";

import { CourseCreateForm } from "../components/CourseCreateForm.js";
import { useAdminCourses } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { statusTone } from "../components/status-tone.js";

export type CourseAdminListProps = {
  /** The host's back-office page of a course. */
  readonly courseHref: (course: ApiAdminCourse) => string;
  readonly onCreated?: ((course: ApiAdminCourse) => void) | undefined;
};

/** Every course the admin can manage, plus the shared catalog read only, and a creation form. */
export function CourseAdminList({ courseHref, onCreated }: CourseAdminListProps) {
  const { Badge } = useUi();
  const { t } = useAdmin();
  const courses = useAdminCourses();
  const [search, setSearch] = useState("");
  if (courses.isPending) return <QueryState kind="loading" />;
  if (courses.isError) {
    return <QueryState kind="error" error={courses.error} onRetry={() => void courses.refetch()} />;
  }
  const all = courses.data.data;
  const list = all.filter((course) =>
    `${course.title} ${course.summary ?? ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <section className="el-admin-courses" aria-labelledby="el-admin-courses-title">
      <h2 id="el-admin-courses-title">{t.t("courses.title")}</h2>
      <p className="el-meta">{t.t("workspace.help")}</p>
      <div className="el-author-toolbar">
        <TextField label={t.t("courses.search")} value={search} onChange={setSearch} />
        <a className="el-author-create-card" href="#new-course">
          + {t.t("workspace.new")}
        </a>
      </div>
      {all.length === 0 ? <p className="el-meta">{t.t("courses.empty")}</p> : null}
      {all.length > 0 && list.length === 0 ? <p role="status">{t.t("courses.noResults")}</p> : null}
      <ul className="el-admin-list el-author-course-grid">
        {list.map((course) => (
          <li key={course.id}>
            <a
              className="el-author-course-card"
              href={courseHref(course)}
              aria-label={t.t("courses.open", { title: course.title })}
            >
              <span className="el-author-card-title">{course.title}</span>
              <span className="el-meta">{course.summary}</span>
              <Badge tone={statusTone(course.status)} data-status={course.status}>
                {t.t(`status.${course.status}`)}
              </Badge>
              {course.editable ? null : <Badge>{t.t("courses.shared")}</Badge>}
            </a>
          </li>
        ))}
      </ul>
      <CourseCreateForm onCreated={onCreated} />
    </section>
  );
}

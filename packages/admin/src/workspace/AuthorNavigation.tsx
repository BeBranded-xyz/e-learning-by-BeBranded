"use client";

import type { ApiCourseTree } from "@bebranded/elearning-core";
import { useAdminCourse, useAdminCourses, useAdminLesson } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";

export type AuthorNavigationProps = {
  readonly courseId?: string;
  readonly lessonId?: string;
  readonly catalogHref: string;
  readonly courseHref: (id: string) => string;
  readonly lessonHref: (id: string) => string;
};

function NavigationOutline({
  course,
  routes: props,
}: {
  course: ApiCourseTree;
  routes: AuthorNavigationProps;
}) {
  const { t } = useAdmin();
  return (
    <section className="el-author-nav-outline" aria-label={t.t("workspace.outline")}>
      <a
        className="el-author-nav-course"
        href={props.courseHref(course.id)}
        aria-current={!props.lessonId ? "page" : undefined}
      >
        {course.title}
      </a>
      {course.chapters.map((chapter) => (
        <details key={chapter.id} open>
          <summary>{chapter.title}</summary>
          <ul>
            {chapter.lessons.map((item) => (
              <li key={item.id}>
                <a
                  aria-label={t.t("workspace.openLesson", { title: item.title })}
                  href={props.lessonHref(item.id)}
                  aria-current={props.lessonId === item.id ? "page" : undefined}
                >
                  {item.title}
                  <small>{t.t(`type.${item.type}`)}</small>
                </a>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <a href={`${props.courseHref(course.id)}?section=structure#new-chapter`}>
        + {t.t("workspace.addChapter")}
      </a>
    </section>
  );
}

/** Persistent course and lesson links; the host supplies its own routes. */
export function AuthorNavigation(props: AuthorNavigationProps) {
  const { t } = useAdmin();
  const courses = useAdminCourses();
  const lesson = useAdminLesson(props.lessonId ?? "");
  const current = props.courseId ?? lesson.data?.course_id;
  const tree = useAdminCourse(current ?? null);
  return (
    <nav className="el-author-navigation" aria-label={t.t("workspace.navigation")}>
      <a className="el-author-nav-home" href={props.catalogHref}>
        {t.t("workspace.courses")}
      </a>
      <a className="el-author-nav-new" href={`${props.catalogHref}#new-course`}>
        + {t.t("workspace.new")}
      </a>
      {tree.data ? <NavigationOutline course={tree.data} routes={props} /> : null}
      <details open className="el-author-nav-courses">
        <summary>{t.t("courses.title")}</summary>
        {courses.isPending ? (
          <p role="status">…</p>
        ) : courses.isError ? (
          <p role="alert">{t.errorMessage(courses.error)}</p>
        ) : (
          <ul>
            {courses.data.data.map((course) => (
              <li key={course.id}>
                <a
                  href={props.courseHref(course.id)}
                  aria-current={current === course.id && !props.lessonId ? "page" : undefined}
                >
                  {course.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </details>
    </nav>
  );
}

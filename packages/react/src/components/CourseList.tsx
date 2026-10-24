"use client";

import { useId } from "react";

import type { ApiCourseSummary } from "@bebranded/elearning-core";

import { CourseCard } from "./CourseCard.js";
import { useUi } from "../ui/kit.js";

export type CourseListProps = {
  readonly title: string;
  readonly emptyMessage: string;
  readonly courses: readonly ApiCourseSummary[];
  readonly courseHref: (course: ApiCourseSummary) => string;
};

/** A titled list of course cards, used by the catalog and by "My training". */
export function CourseList({ title, emptyMessage, courses, courseHref }: CourseListProps) {
  const titleId = useId();
  const { Alert } = useUi();
  return (
    <section className="el-course-list" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      {courses.length === 0 ? (
        <Alert tone="info">{emptyMessage}</Alert>
      ) : (
        <ul className="el-grid">
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} href={courseHref(course)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

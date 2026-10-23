"use client";

import type { ApiCourseLesson } from "@bebranded/elearning-core";

import { CourseOutline } from "../components/CourseOutline.js";
import { QueryState } from "../components/QueryState.js";
import { useCourse, useEnroll } from "../hooks/queries.js";

export type CoursePageProps = {
  readonly slug: string;
  /** Where a lesson links to, in the host's routes. */
  readonly lessonHref: (lesson: ApiCourseLesson) => string;
};

/** A course with its accessible chapters and lessons, progress and enrollment. */
export function CoursePage({ slug, lessonHref }: CoursePageProps) {
  const course = useCourse(slug);
  const enroll = useEnroll();
  if (course.isPending) return <QueryState kind="loading" />;
  if (course.isError)
    return <QueryState kind="error" error={course.error} onRetry={() => void course.refetch()} />;
  return (
    <CourseOutline
      course={course.data}
      lessonHref={lessonHref}
      onEnroll={() => {
        enroll.mutate(course.data.id);
      }}
      enrolling={enroll.isPending}
    />
  );
}

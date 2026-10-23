"use client";

import type { ApiCourseSummary } from "@bebranded/elearning-core";

import { CourseList } from "../components/CourseList.js";
import { QueryState } from "../components/QueryState.js";
import { useMyProgress } from "../hooks/queries.js";
import { useElearning } from "../provider/context.js";

export type MyTrainingProps = { readonly courseHref: (course: ApiCourseSummary) => string };

/** The learner's enrollments with progress and due dates ("My training"). */
export function MyTraining({ courseHref }: MyTrainingProps) {
  const { i18n } = useElearning();
  const mine = useMyProgress();
  if (mine.isPending) return <QueryState kind="loading" />;
  if (mine.isError)
    return <QueryState kind="error" error={mine.error} onRetry={() => void mine.refetch()} />;
  return (
    <CourseList
      title={i18n.t("myTraining.title")}
      emptyMessage={i18n.t("myTraining.empty")}
      courses={mine.data.data}
      courseHref={courseHref}
    />
  );
}

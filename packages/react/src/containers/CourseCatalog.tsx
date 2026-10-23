"use client";

import type { ApiCourseSummary } from "@bebranded/elearning-core";

import { CourseList } from "../components/CourseList.js";
import { QueryState } from "../components/QueryState.js";
import { useCatalog } from "../hooks/queries.js";
import { useElearning } from "../provider/context.js";

export type CourseCatalogProps = {
  /** Where a course card links to, in the host's routes. */
  readonly courseHref: (course: ApiCourseSummary) => string;
};

/** The courses the learner may see (spec 05), with their progress. */
export function CourseCatalog({ courseHref }: CourseCatalogProps) {
  const { i18n } = useElearning();
  const catalog = useCatalog();
  if (catalog.isPending) return <QueryState kind="loading" />;
  if (catalog.isError)
    return <QueryState kind="error" error={catalog.error} onRetry={() => void catalog.refetch()} />;
  return (
    <CourseList
      title={i18n.t("catalog.title")}
      emptyMessage={i18n.t("catalog.empty")}
      courses={catalog.data.data}
      courseHref={courseHref}
    />
  );
}

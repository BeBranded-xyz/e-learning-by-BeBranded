"use client";

import type { ApiAdminLessonSummary } from "@bebranded/elearning-core";
import { ExportActions, QueryState } from "@bebranded/elearning-react";

import { AccessRulesEditor } from "../components/AccessRulesEditor.js";
import { AssignmentsEditor } from "../components/AssignmentsEditor.js";
import { ContentTree } from "../components/ContentTree.js";
import { CourseSettings } from "../components/CourseSettings.js";
import { useAdminCourse } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { CourseReport } from "../reports/CourseReport.js";

export type CourseAdminProps = {
  readonly courseId: string;
  /** The host's back-office page of a lesson. */
  readonly lessonHref: (lesson: ApiAdminLessonSummary) => string;
  /** Host roles for the audience menus (spec 05, `listRoles`). */
  readonly roles?: readonly string[] | undefined;
  readonly onDeleted?: (() => void) | undefined;
  /** The host's page of one learner's report, linked from the tracking table. */
  readonly learnerHref?: ((learnerId: string) => string) | undefined;
};

/** One course in the back-office: settings, content tree, access rules, assignments, tracking. */
export function CourseAdmin({
  courseId,
  lessonHref,
  roles,
  onDeleted,
  learnerHref,
}: CourseAdminProps) {
  const { t } = useAdmin();
  const course = useAdminCourse(courseId);
  if (course.isPending) return <QueryState kind="loading" />;
  if (course.isError) {
    return <QueryState kind="error" error={course.error} onRetry={() => void course.refetch()} />;
  }
  const tree = course.data;
  return (
    <article className="el-admin-course" aria-labelledby="el-admin-course-title">
      <h2 id="el-admin-course-title">{tree.title}</h2>
      <ExportActions kind="course" id={tree.id} formats={tree.export_formats} />
      <CourseSettings
        key={`${tree.id}-${tree.title}-${tree.slug}`}
        course={tree}
        onDeleted={onDeleted}
      />
      <ContentTree course={tree} lessonHref={lessonHref} />
      <section aria-labelledby="el-admin-rules-title">
        <h3 id="el-admin-rules-title">{t.t("rules.title")}</h3>
        <AccessRulesEditor
          courseId={tree.id}
          targetType="course"
          targetId={tree.id}
          rules={tree.access_rules}
          roles={roles}
          editable={tree.editable}
        />
      </section>
      <AssignmentsEditor courseId={tree.id} roles={roles} />
      <CourseReport courseId={tree.id} learnerHref={learnerHref} />
    </article>
  );
}

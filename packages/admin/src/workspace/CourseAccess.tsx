"use client";

import type { ApiCourseTree } from "@bebranded/elearning-core";
import { AccessRulesEditor } from "../components/AccessRulesEditor.js";
import { AssignmentsEditor } from "../components/AssignmentsEditor.js";
import { useAdmin } from "../provider/admin-context.js";

export function CourseAccess({
  course,
  roles,
}: {
  readonly course: ApiCourseTree;
  readonly roles?: readonly string[];
}) {
  const { t } = useAdmin();
  const shared = {
    courseId: course.id,
    rules: course.access_rules,
    roles,
    editable: course.editable,
  };
  return (
    <section className="el-author-stack" aria-label={t.t("workspace.access")}>
      <p className="el-meta">{t.t("access.help")}</p>
      <h3>{t.t("access.course")}</h3>
      <AccessRulesEditor {...shared} targetType="course" targetId={course.id} />
      <h3>{t.t("access.chapters")}</h3>
      <p className="el-meta">{t.t("access.inherit")}</p>
      {course.chapters.map((chapter) => (
        <details key={chapter.id} className="el-author-disclosure">
          <summary>{chapter.title}</summary>
          <AccessRulesEditor {...shared} targetType="chapter" targetId={chapter.id} />
        </details>
      ))}
      <h3>{t.t("access.enrollment")}</h3>
      <AssignmentsEditor courseId={course.id} roles={roles} />
    </section>
  );
}

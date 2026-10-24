"use client";
import type { ApiAdminLesson, ApiCourseTree } from "@bebranded/elearning-core";
import type { LessonAdminProps } from "../containers/LessonAdmin.js";
import { useAdmin } from "../provider/admin-context.js";
import { WorkspaceHeading } from "./WorkspaceHeading.js";
import { LessonPreview } from "./LessonPreview.js";
import { LessonEditPanels } from "./LessonEditPanels.js";
import { AccessRulesEditor } from "../components/AccessRulesEditor.js";
import { LESSON_SECTIONS, WorkspaceNavigation } from "./WorkspaceNavigation.js";
import type { LessonSection } from "./WorkspaceNavigation.js";

type Props = {
  data: ApiAdminLesson;
  tree: ApiCourseTree;
  section: LessonSection;
  onSectionChange: (section: LessonSection) => void;
  routes: LessonAdminProps;
};
export function LessonWorkspaceView({
  data,
  tree,
  section,
  onSectionChange,
  routes: props,
}: Props) {
  const { t } = useAdmin();
  return (
    <article className="el-author-workspace" aria-labelledby="el-author-lesson-title">
      {props.courseHref ? (
        <a href={props.courseHref(data.course_id)}>{t.t("lesson.back")}</a>
      ) : null}
      <WorkspaceHeading
        id="el-author-lesson-title"
        title={data.title}
        status={data.status}
        subtitle={`${tree.title} / ${t.t(`type.${data.type}`)}`}
      />
      <WorkspaceNavigation sections={LESSON_SECTIONS} active={section} onChange={onSectionChange} />
      {tree.editable ? (
        <LessonEditPanels
          lesson={data}
          course={tree}
          section={section}
          onDeleted={props.onDeleted}
        />
      ) : (
        <p className="el-meta">{t.t("courses.shared")}</p>
      )}
      <div className="el-author-panel" hidden={section !== "access"}>
        <p className="el-meta">{t.t("access.inherit")}</p>
        <AccessRulesEditor
          courseId={data.course_id}
          targetType="lesson"
          targetId={data.id}
          rules={tree.access_rules}
          roles={props.roles}
          editable={tree.editable}
        />
      </div>
      {section === "preview" || !tree.editable ? <LessonPreview lessonId={data.id} /> : null}
    </article>
  );
}

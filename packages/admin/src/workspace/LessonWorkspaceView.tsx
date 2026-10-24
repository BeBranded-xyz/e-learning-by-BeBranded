"use client";
import { WorkspacePanel } from "./WorkspacePanel.js";
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
      <WorkspaceNavigation
        scope={data.id}
        sections={LESSON_SECTIONS}
        active={section}
        onChange={onSectionChange}
      />
      <LessonPanels data={data} tree={tree} section={section} routes={props} />
    </article>
  );
}

function SharedLessonPanels({ data, section }: Pick<Props, "data" | "section">) {
  const { t } = useAdmin();
  return (
    <>
      <p className="el-meta">{t.t("courses.shared")}</p>
      <WorkspacePanel scope={data.id} section="content" active={section}>
        {section === "content" ? <LessonPreview lessonId={data.id} /> : null}
      </WorkspacePanel>
      <WorkspacePanel scope={data.id} section="settings" active={section}>
        {t.t("courses.shared")}
      </WorkspacePanel>
      <WorkspacePanel scope={data.id} section="completion" active={section}>
        {t.t("courses.shared")}
      </WorkspacePanel>
    </>
  );
}

function LessonPanels({ data, tree, section, routes: props }: Omit<Props, "onSectionChange">) {
  const { t } = useAdmin();
  return (
    <>
      {tree.editable ? (
        <LessonEditPanels
          lesson={data}
          course={tree}
          section={section}
          onDeleted={props.onDeleted}
        />
      ) : (
        <SharedLessonPanels data={data} section={section} />
      )}
      <WorkspacePanel scope={data.id} section="access" active={section}>
        <p className="el-meta">{t.t("access.inherit")}</p>
        <AccessRulesEditor
          courseId={data.course_id}
          targetType="lesson"
          targetId={data.id}
          rules={tree.access_rules}
          roles={props.roles}
          editable={tree.editable}
        />
      </WorkspacePanel>
      <WorkspacePanel scope={data.id} section="preview" active={section}>
        {section === "preview" ? <LessonPreview lessonId={data.id} /> : null}
      </WorkspacePanel>
    </>
  );
}

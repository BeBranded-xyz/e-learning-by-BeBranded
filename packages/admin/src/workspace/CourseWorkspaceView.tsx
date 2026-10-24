"use client";
import { WorkspacePanel } from "./WorkspacePanel.js";
import type { ApiCourseTree } from "@bebranded/elearning-core";
import { ExportActions } from "@bebranded/elearning-react";
import type { CourseAdminProps } from "../containers/CourseAdmin.js";
import { useAdmin } from "../provider/admin-context.js";
import { ContentTree } from "../components/ContentTree.js";
import { CourseSettings } from "../components/CourseSettings.js";
import { CourseReport } from "../reports/CourseReport.js";
import { WorkspaceHeading } from "./WorkspaceHeading.js";
import { CompletionSettings } from "./CompletionSettings.js";
import { CourseAccess } from "./CourseAccess.js";
import { CoursePreview } from "./CoursePreview.js";
import { COURSE_SECTIONS, WorkspaceNavigation } from "./WorkspaceNavigation.js";
import type { CourseSection } from "./WorkspaceNavigation.js";

type Props = {
  tree: ApiCourseTree;
  section: CourseSection;
  onSectionChange: (section: CourseSection) => void;
  routes: CourseAdminProps;
};
export function CourseWorkspaceView({ tree, section, onSectionChange, routes: props }: Props) {
  const { t } = useAdmin();
  const lessons = tree.chapters.flatMap((chapter) => chapter.lessons);
  return (
    <article className="el-author-workspace" aria-labelledby="el-author-course-title">
      <WorkspaceHeading
        id="el-author-course-title"
        title={tree.title}
        status={tree.status}
        subtitle={`${t.t("workspace.chapters", { count: tree.chapters.length })} · ${t.t("workspace.lessons", { count: lessons.length })}`}
      />
      <WorkspaceNavigation
        scope={tree.id}
        sections={COURSE_SECTIONS}
        active={section}
        onChange={onSectionChange}
      />
      <WorkspacePanel scope={tree.id} section="structure" active={section}>
        <p className="el-meta">{t.t("workspace.chapterHelp")}</p>
        <ContentTree course={tree} lessonHref={props.lessonHref} />
      </WorkspacePanel>
      <WorkspacePanel scope={tree.id} section="settings" active={section}>
        <CourseSettings key={tree.id} course={tree} onDeleted={props.onDeleted} />
        <ExportActions kind="course" id={tree.id} formats={tree.export_formats} />
      </WorkspacePanel>
      <WorkspacePanel scope={tree.id} section="completion" active={section}>
        <CompletionSettings key={tree.id} course={tree} />
      </WorkspacePanel>
      <WorkspacePanel scope={tree.id} section="access" active={section}>
        <CourseAccess course={tree} roles={props.roles} />
      </WorkspacePanel>
      <WorkspacePanel scope={tree.id} section="tracking" active={section}>
        {section === "tracking" ? (
          <CourseReport courseId={tree.id} learnerHref={props.learnerHref} />
        ) : null}
      </WorkspacePanel>
      <WorkspacePanel scope={tree.id} section="preview" active={section}>
        {section === "preview" ? <CoursePreview course={tree} /> : null}
      </WorkspacePanel>
    </article>
  );
}

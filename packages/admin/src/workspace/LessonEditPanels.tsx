"use client";

import { WorkspacePanel } from "./WorkspacePanel.js";
import type { ApiAdminLesson, ApiCourseTree } from "@bebranded/elearning-core";
import { ExportActions } from "@bebranded/elearning-react";
import { LessonEditor } from "../lesson/LessonEditor.js";
import { LessonSettings } from "../lesson/LessonSettings.js";
import { LessonValidation } from "./LessonValidation.js";
import type { LessonSection } from "./WorkspaceNavigation.js";

type Props = {
  lesson: ApiAdminLesson;
  course: ApiCourseTree;
  section: LessonSection;
  onDeleted?: () => void;
};
export function LessonEditPanels({ lesson, course, section, onDeleted }: Props) {
  return (
    <>
      <WorkspacePanel scope={lesson.id} section="content" active={section}>
        <LessonEditor lesson={lesson} />
      </WorkspacePanel>
      <WorkspacePanel scope={lesson.id} section="settings" active={section}>
        <LessonSettings
          key={lesson.id}
          lesson={lesson}
          onDeleted={onDeleted}
          showRequired={false}
        />
        <ExportActions kind="lesson" id={lesson.id} formats={course.export_formats} />
      </WorkspacePanel>
      <WorkspacePanel scope={lesson.id} section="completion" active={section}>
        <LessonValidation key={lesson.id} lesson={lesson} />
      </WorkspacePanel>
    </>
  );
}

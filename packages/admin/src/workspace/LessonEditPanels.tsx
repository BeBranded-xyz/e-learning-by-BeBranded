"use client";

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
      <div className="el-author-panel" hidden={section !== "content"}>
        <LessonEditor lesson={lesson} />
      </div>
      <div className="el-author-panel" hidden={section !== "settings"}>
        <LessonSettings
          key={lesson.id}
          lesson={lesson}
          onDeleted={onDeleted}
          showRequired={false}
        />
        <ExportActions kind="lesson" id={lesson.id} formats={course.export_formats} />
      </div>
      <div className="el-author-panel" hidden={section !== "completion"}>
        <LessonValidation key={lesson.id} lesson={lesson} />
      </div>
    </>
  );
}

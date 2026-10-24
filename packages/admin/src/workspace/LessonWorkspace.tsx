"use client";

import { useState } from "react";
import { LessonWorkspaceView } from "./LessonWorkspaceView.js";
import { QueryState } from "@bebranded/elearning-react";
import type { LessonAdminProps } from "../containers/LessonAdmin.js";
import { useAdminCourse, useAdminLesson } from "../hooks/admin-queries.js";
import type { LessonSection } from "./WorkspaceNavigation.js";

export type LessonWorkspaceProps = LessonAdminProps & {
  readonly section?: LessonSection;
  readonly onSectionChange?: (section: LessonSection) => void;
};

export function LessonWorkspace(props: LessonWorkspaceProps) {
  const lesson = useAdminLesson(props.lessonId);
  const course = useAdminCourse(lesson.data?.course_id ?? null);
  const [localSection, setLocalSection] = useState<LessonSection>("content");
  const section = props.section ?? localSection;
  if (lesson.isError)
    return (
      <QueryState
        kind="error"
        error={lesson.error}
        onRetry={() => {
          void lesson.refetch();
        }}
      />
    );
  if (lesson.isPending || course.isPending) return <QueryState kind="loading" />;
  if (course.isError)
    return (
      <QueryState
        kind="error"
        error={course.error}
        onRetry={() => {
          void course.refetch();
        }}
      />
    );
  return (
    <LessonWorkspaceView
      data={lesson.data}
      tree={course.data}
      section={section}
      onSectionChange={props.onSectionChange ?? setLocalSection}
      routes={props}
    />
  );
}

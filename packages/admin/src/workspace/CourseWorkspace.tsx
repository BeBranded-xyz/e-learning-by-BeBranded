"use client";
import { useState } from "react";
import { QueryState } from "@bebranded/elearning-react";
import type { CourseAdminProps } from "../containers/CourseAdmin.js";
import { useAdminCourse } from "../hooks/admin-queries.js";
import type { CourseSection } from "./WorkspaceNavigation.js";
import { CourseWorkspaceView } from "./CourseWorkspaceView.js";

export type CourseWorkspaceProps = CourseAdminProps & {
  readonly section?: CourseSection;
  readonly onSectionChange?: (section: CourseSection) => void;
};

/** Focused authoring views; editing forms stay mounted so switching sections keeps drafts. */
export function CourseWorkspace(props: CourseWorkspaceProps) {
  const [localSection, setLocalSection] = useState<CourseSection>("structure");
  const section = props.section ?? localSection;
  const course = useAdminCourse(props.courseId);
  if (course.isPending) return <QueryState kind="loading" />;
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
    <CourseWorkspaceView
      tree={course.data}
      section={section}
      onSectionChange={props.onSectionChange ?? setLocalSection}
      routes={props}
    />
  );
}

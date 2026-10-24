"use client";

import { useAssignments, useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { AssignmentForm } from "./AssignmentForm.js";
import { useAudienceLabel } from "./AudienceFields.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { useUi } from "@bebranded/elearning-react";

export type AssignmentsEditorProps = {
  readonly courseId: string;
  readonly roles?: readonly string[] | undefined;
};

/** Assigns the course to a role, a grade or a learner, with an optional due date (spec 05). */
export function AssignmentsEditor({ courseId, roles }: AssignmentsEditorProps) {
  const { Button } = useUi();
  const { t } = useAdmin();
  const label = useAudienceLabel();
  const assignments = useAssignments(courseId);
  const add = useCourseMutation(courseId, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.createAssignment(body),
  );
  const remove = useCourseMutation(courseId, (admin, id: string) => admin.deleteAssignment(id));
  const list = assignments.data?.data ?? [];
  return (
    <section className="el-admin-assignments" aria-labelledby={`assign-${courseId}`}>
      <h3 id={`assign-${courseId}`}>{t.t("assign.title")}</h3>
      {assignments.isSuccess && list.length === 0 ? (
        <p className="el-meta">{t.t("assign.none")}</p>
      ) : null}
      <ul>
        {list.map((assignment) => (
          <li key={assignment.id}>
            <span>{label(assignment.audience)}</span>
            <span className="el-meta">
              {assignment.due_at === null
                ? t.t("assign.noDue")
                : t.t("assign.due", { date: t.formatDate(assignment.due_at) })}
            </span>
            <Button
              aria-label={t.t("assign.remove", { audience: label(assignment.audience) })}
              onClick={() => {
                remove.mutate(assignment.id);
              }}
            >
              {t.t("action.delete")}
            </Button>
          </li>
        ))}
      </ul>
      <AssignmentForm
        roles={roles}
        pending={add.isPending}
        onSubmit={(body, reset) => {
          add.mutate({ course_id: courseId, ...body }, { onSuccess: reset });
        }}
      />
      <ErrorAlert error={add.error ?? remove.error} />
    </section>
  );
}

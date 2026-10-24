"use client";

import type { ApiAdminCourse } from "@bebranded/elearning-core";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { DeleteButton } from "./DeleteButton.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { SelectField, TextField } from "./Fields.js";
import type { TextFieldProps } from "./Fields.js";

export type CourseSettingsProps = {
  readonly course: ApiAdminCourse;
  readonly onDeleted?: (() => void) | undefined;
};

type Draft = Pick<ApiAdminCourse, "title" | "slug" | "summary" | "enrollment_mode">;

const PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";

type TextKey = "title" | "slug" | "summary";

const TEXT_FIELDS: readonly {
  key: TextKey;
  label: "field.title" | "field.slug" | "field.summary";
  input: Partial<TextFieldProps>;
}[] = [
  { key: "title", label: "field.title", input: { required: true, maxLength: 200 } },
  { key: "slug", label: "field.slug", input: { required: true, maxLength: 100, pattern: PATTERN } },
  { key: "summary", label: "field.summary", input: { multiline: true, maxLength: 2000 } },
];

function CourseFields(props: {
  draft: Draft;
  disabled: boolean;
  onChange: (draft: Draft) => void;
}) {
  const { t } = useAdmin();
  const { draft, disabled } = props;
  const set = (patch: Partial<Draft>) => {
    props.onChange({ ...draft, ...patch });
  };
  const modes = (["self", "assignment_only"] as const).map((mode) => ({
    value: mode,
    label: t.t(`enrollment.${mode}`),
  }));
  return (
    <>
      {TEXT_FIELDS.map((field) => (
        <TextField
          key={field.key}
          {...field.input}
          label={t.t(field.label)}
          disabled={disabled}
          value={draft[field.key] ?? ""}
          onChange={(value) => {
            set({ [field.key]: value });
          }}
        />
      ))}
      <SelectField
        label={t.t("field.enrollmentMode")}
        disabled={disabled}
        value={draft.enrollment_mode}
        options={modes}
        onChange={(mode) => {
          set({ enrollment_mode: mode });
        }}
      />
    </>
  );
}

function CourseActions(props: { course: ApiAdminCourse; onDeleted?: (() => void) | undefined }) {
  const { t } = useAdmin();
  const { course } = props;
  const publish = useCourseMutation(course.id, (admin, status: "draft" | "published") =>
    admin.updateCourse(course.id, { status }),
  );
  const remove = useCourseMutation(null, (admin) => admin.deleteCourse(course.id));
  const published = course.status === "published";
  return (
    <>
      <button
        type="button"
        className="el-button"
        disabled={publish.isPending}
        onClick={() => {
          publish.mutate(published ? "draft" : "published");
        }}
      >
        {published ? t.t("action.unpublish") : t.t("action.publish")}
      </button>
      <DeleteButton
        title={course.title}
        disabled={remove.isPending}
        onConfirm={() => {
          remove.mutate(undefined, { onSuccess: () => props.onDeleted?.() });
        }}
      />
      <ErrorAlert error={publish.error ?? remove.error} />
    </>
  );
}

/** Title, slug, summary and enrollment mode of a course, its publication, and its deletion. */
export function CourseSettings({ course, onDeleted }: CourseSettingsProps) {
  const { t } = useAdmin();
  const [draft, setDraft] = useState<Draft>(() => ({
    title: course.title,
    slug: course.slug,
    summary: course.summary,
    enrollment_mode: course.enrollment_mode,
  }));
  const save = useCourseMutation(course.id, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.updateCourse(course.id, body),
  );
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const summary = draft.summary?.trim() ?? "";
    save.mutate({ ...draft, title: draft.title.trim(), summary: summary === "" ? null : summary });
  };
  return (
    <form className="el-admin-form" onSubmit={submit} aria-label={course.title}>
      <CourseFields draft={draft} disabled={!course.editable} onChange={setDraft} />
      <p className="el-meta">
        {t.t("field.status")}:{" "}
        <span className="el-tag" data-status={course.status}>
          {t.t(`status.${course.status}`)}
        </span>
      </p>
      {course.editable ? (
        <div className="el-admin-actions">
          <button type="submit" className="el-button el-button-primary" disabled={save.isPending}>
            {save.isPending ? t.t("action.saving") : t.t("action.save")}
          </button>
          <CourseActions course={course} onDeleted={onDeleted} />
        </div>
      ) : null}
      {save.isSuccess ? <p role="status">{t.t("action.saved")}</p> : null}
      <ErrorAlert error={save.error} />
    </form>
  );
}

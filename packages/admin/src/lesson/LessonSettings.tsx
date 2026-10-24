"use client";

import type { ApiAdminLesson } from "@bebranded/elearning-core";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import { DeleteButton } from "../components/DeleteButton.js";
import { ErrorAlert } from "../components/ErrorAlert.js";
import { CheckboxField, TextField } from "../components/Fields.js";
import { useLessonMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";

export type LessonSettingsProps = {
  readonly lesson: ApiAdminLesson;
  readonly onDeleted?: (() => void) | undefined;
};

function LessonActions({ lesson, onDeleted }: LessonSettingsProps) {
  const { t } = useAdmin();
  const publish = useLessonMutation(lesson, (admin, status: "draft" | "published") =>
    admin.updateLesson(lesson.id, { status }),
  );
  const remove = useLessonMutation(lesson, (admin) => admin.deleteLesson(lesson.id));
  const published = lesson.status === "published";
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
        title={lesson.title}
        onConfirm={() => {
          remove.mutate(undefined, { onSuccess: () => onDeleted?.() });
        }}
      />
      <ErrorAlert error={publish.error ?? remove.error} />
    </>
  );
}

/** Title, estimated time and whether the course needs the lesson; publication and deletion. */
export function LessonSettings({ lesson, onDeleted }: LessonSettingsProps) {
  const { t } = useAdmin();
  const [title, setTitle] = useState(lesson.title);
  const [minutes, setMinutes] = useState(lesson.estimated_minutes?.toString() ?? "");
  const [required, setRequired] = useState(lesson.is_required);
  const save = useLessonMutation(lesson, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.updateLesson(lesson.id, body),
  );
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const estimated = minutes.trim() === "" ? null : Number(minutes);
    save.mutate({ title: title.trim(), estimated_minutes: estimated, is_required: required });
  };
  return (
    <form className="el-admin-form" onSubmit={submit} aria-label={lesson.title}>
      <TextField
        label={t.t("field.title")}
        required
        maxLength={200}
        value={title}
        onChange={setTitle}
      />
      <TextField
        label={t.t("field.minutes")}
        type="number"
        min={1}
        max={10_000}
        value={minutes}
        onChange={setMinutes}
      />
      <CheckboxField label={t.t("field.required")} checked={required} onChange={setRequired} />
      <div className="el-admin-actions">
        <button type="submit" className="el-button el-button-primary" disabled={save.isPending}>
          {save.isPending ? t.t("action.saving") : t.t("action.save")}
        </button>
        <LessonActions lesson={lesson} onDeleted={onDeleted} />
      </div>
      {save.isSuccess ? <p role="status">{t.t("action.saved")}</p> : null}
      <ErrorAlert error={save.error} />
    </form>
  );
}

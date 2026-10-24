"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { SelectField, TextField } from "./Fields.js";
import { useUi } from "@bebranded/elearning-react";

type LessonType = "text" | "video" | "quiz";

export type AddLessonFormProps = {
  readonly courseId: string;
  readonly chapterId: string;
  readonly position: number;
};

function LessonFields({
  title,
  type,
  onTitle,
  onType,
}: {
  title: string;
  type: LessonType;
  onTitle: (value: string) => void;
  onType: (value: LessonType) => void;
}) {
  const { t } = useAdmin();
  return (
    <>
      <TextField
        label={t.t("tree.lessonTitle")}
        required
        maxLength={200}
        value={title}
        onChange={onTitle}
      />
      <SelectField
        label={t.t("field.lessonType")}
        value={type}
        options={(["text", "video", "quiz"] as const).map((value) => ({
          value,
          label: t.t(`type.${value}`),
        }))}
        onChange={onType}
      />
    </>
  );
}

/** Adds a draft lesson at the end of a chapter. */
export function AddLessonForm({ courseId, chapterId, position }: AddLessonFormProps) {
  const { Button } = useUi();
  const { t } = useAdmin();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LessonType>("text");
  const create = useCourseMutation(courseId, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.createLesson(body),
  );
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    create.mutate(
      { chapter_id: chapterId, title: title.trim(), type, position },
      {
        onSuccess: () => {
          setTitle((current) => (current === title ? "" : current));
        },
      },
    );
  };
  return (
    <details className="el-author-add-lesson">
      <summary>{t.t("tree.addLesson")}</summary>
      <form
        className="el-author-creation-form"
        onSubmit={submit}
        aria-label={t.t("tree.addLesson")}
      >
        <LessonFields title={title} type={type} onTitle={setTitle} onType={setType} />
        <Button type="submit" disabled={create.isPending}>
          {t.t("tree.addLesson")}
        </Button>
        <ErrorAlert error={create.error} />
      </form>
    </details>
  );
}

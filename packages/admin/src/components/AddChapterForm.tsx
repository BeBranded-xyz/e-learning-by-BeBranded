"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { TextField } from "./Fields.js";

/** Adds a draft chapter at the end of the course. */
export function AddChapterForm({ courseId, position }: { courseId: string; position: number }) {
  const { t } = useAdmin();
  const [title, setTitle] = useState("");
  const create = useCourseMutation(courseId, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.createChapter(body),
  );
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    create.mutate(
      { course_id: courseId, title: title.trim(), position },
      {
        onSuccess: () => {
          setTitle("");
        },
      },
    );
  };
  return (
    <form className="el-admin-inline-form" onSubmit={submit} aria-label={t.t("tree.addChapter")}>
      <TextField
        label={t.t("tree.chapterTitle")}
        required
        maxLength={200}
        value={title}
        onChange={setTitle}
      />
      <button type="submit" className="el-button" disabled={create.isPending}>
        {t.t("tree.addChapter")}
      </button>
      <ErrorAlert error={create.error} />
    </form>
  );
}

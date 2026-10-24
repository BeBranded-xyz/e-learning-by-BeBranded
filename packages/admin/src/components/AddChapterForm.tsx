"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { TextField } from "./Fields.js";
import { useUi } from "@bebranded/elearning-react";

/** Adds a draft chapter at the end of the course. */
export function AddChapterForm({ courseId, position }: { courseId: string; position: number }) {
  const { Button } = useUi();
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
          setTitle((current) => (current === title ? "" : current));
        },
      },
    );
  };
  return (
    <form
      id="new-chapter"
      className="el-admin-inline-form"
      onSubmit={submit}
      aria-label={t.t("tree.addChapter")}
    >
      <TextField
        label={t.t("tree.chapterTitle")}
        required
        maxLength={200}
        value={title}
        onChange={setTitle}
      />
      <Button type="submit" disabled={create.isPending}>
        {t.t("tree.addChapter")}
      </Button>
      <ErrorAlert error={create.error} />
    </form>
  );
}

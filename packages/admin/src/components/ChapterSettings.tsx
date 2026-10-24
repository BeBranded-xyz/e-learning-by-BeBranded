"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useUi } from "@bebranded/elearning-react";
import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { TextField } from "./Fields.js";
import { ErrorAlert } from "./ErrorAlert.js";

export function ChapterSettings({
  courseId,
  chapter,
}: {
  readonly courseId: string;
  readonly chapter: { id: string; title: string };
}) {
  const { t } = useAdmin();
  const { Button } = useUi();
  const [title, setTitle] = useState(chapter.title);
  const save = useCourseMutation(courseId, (admin, title: string) =>
    admin.updateChapter(chapter.id, { title }),
  );
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    save.mutate(title.trim());
  };
  return (
    <form
      className="el-admin-inline-form"
      aria-label={t.t("action.edit") + ": " + chapter.title}
      onSubmit={submit}
    >
      <TextField
        label={t.t("chapter.rename")}
        value={title}
        required
        maxLength={200}
        onChange={setTitle}
      />
      <Button type="submit" disabled={save.isPending}>
        {t.t("action.save")}
      </Button>
      {save.isSuccess ? <p role="status">{t.t("action.saved")}</p> : null}
      <ErrorAlert error={save.error} />
    </form>
  );
}

"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import {
  quizLessonSettingsSchema,
  textLessonSettingsSchema,
  videoLessonSettingsSchema,
} from "@bebranded/elearning-core";
import type { ApiAdminLesson } from "@bebranded/elearning-core";
import { useUi } from "@bebranded/elearning-react";

import { useLessonMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { CheckboxField } from "../components/Fields.js";
import { ErrorAlert } from "../components/ErrorAlert.js";
import { quizFields, textFields, videoFields } from "./lesson-setting-fields.js";
import { ValidationFields } from "./ValidationFields.js";

function initialSettings(lesson: ApiAdminLesson): Record<string, string | boolean> {
  const schemas = {
    text: textLessonSettingsSchema,
    video: videoLessonSettingsSchema,
    quiz: quizLessonSettingsSchema,
  };
  const schema = schemas[lesson.type];
  const result = schema.safeParse(lesson.settings);
  const settings = result.success ? result.data : schema.parse({});
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [
      key,
      typeof value === "boolean" ? value : value === null ? "" : String(value),
    ]),
  );
}

/** Author-facing values map to the exact per-type schemas already enforced by the API. */
export function LessonValidation({ lesson }: { readonly lesson: ApiAdminLesson }) {
  const { t } = useAdmin();
  const { Button } = useUi();
  const [draft, setDraft] = useState(() => initialSettings(lesson));
  const [required, setRequired] = useState(lesson.is_required);
  const fields = { text: textFields, video: videoFields, quiz: quizFields }[lesson.type];
  const save = useLessonMutation(lesson, (admin, settings: Readonly<Record<string, unknown>>) =>
    admin.updateLesson(lesson.id, { settings, is_required: required }),
  );
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const settings = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [
        key,
        typeof value === "boolean" || key === "showCorrection"
          ? value
          : value === ""
            ? null
            : Number(value),
      ]),
    );
    save.mutate(settings);
  };
  return (
    <form className="el-admin-form" aria-label={t.t("workspace.completion")} onSubmit={submit}>
      <h3>{t.t("workspace.completion")}</h3>
      <p className="el-meta">{t.t("validation.help")}</p>
      <CheckboxField label={t.t("field.required")} checked={required} onChange={setRequired} />
      <ValidationFields
        fields={fields}
        draft={draft}
        quiz={lesson.type === "quiz"}
        onChange={(key, value) => {
          setDraft((current) => ({ ...current, [key]: value }));
        }}
      />
      <Button variant="primary" type="submit" disabled={save.isPending}>
        {t.t("action.save")}
      </Button>
      {save.isSuccess ? <p role="status">{t.t("action.saved")}</p> : null}
      <ErrorAlert error={save.error} />
    </form>
  );
}

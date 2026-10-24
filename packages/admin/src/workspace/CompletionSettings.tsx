"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { ApiAdminCourse, CompletionRule } from "@bebranded/elearning-core";
import { useUi } from "@bebranded/elearning-react";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { SelectField, TextField } from "../components/Fields.js";
import { ErrorAlert } from "../components/ErrorAlert.js";

function initialPercent(course: ApiAdminCourse): string {
  return String(
    course.completion_rule.type === "percentage" ? course.completion_rule.threshold * 100 : 100,
  );
}

function policy(mode: CompletionRule["type"], percent: string): CompletionRule {
  return mode === "percentage" ? { type: mode, threshold: Number(percent) / 100 } : { type: mode };
}

/** The same required-lesson denominator is used for either completion policy. */
export function CompletionSettings({ course }: { readonly course: ApiAdminCourse }) {
  const { t } = useAdmin();
  const { Button } = useUi();
  const [mode, setMode] = useState(course.completion_rule.type);
  const [percent, setPercent] = useState(() => initialPercent(course));
  const save = useCourseMutation(course.id, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.updateCourse(course.id, body),
  );
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    save.mutate({ completion_rule: policy(mode, percent) });
  };
  return (
    <form className="el-admin-form" aria-label={t.t("workspace.completion")} onSubmit={submit}>
      <h3>{t.t("workspace.completion")}</h3>
      <p className="el-meta">{t.t("completion.help")}</p>
      <SelectField
        label={t.t("completion.mode")}
        value={mode}
        disabled={!course.editable}
        onChange={setMode}
        options={[
          { value: "all_required_lessons", label: t.t("completion.all") },
          { value: "percentage", label: t.t("completion.percentage") },
        ]}
      />
      {mode === "percentage" ? (
        <TextField
          label={t.t("completion.percent")}
          type="number"
          min={1}
          max={100}
          required
          value={percent}
          disabled={!course.editable}
          onChange={setPercent}
        />
      ) : null}
      {course.editable ? (
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {t.t("action.save")}
        </Button>
      ) : null}
      {save.isSuccess ? <p role="status">{t.t("action.saved")}</p> : null}
      <ErrorAlert error={save.error} />
    </form>
  );
}

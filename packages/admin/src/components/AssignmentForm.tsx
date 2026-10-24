"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";

import { useAdmin } from "../provider/admin-context.js";
import { AudienceFields, audienceBody } from "./AudienceFields.js";
import type { AudienceDraft } from "./AudienceFields.js";
import { TextField } from "./Fields.js";

/** A date input's day as the end of that day in UTC, so "due on the 31st" includes the 31st. */
function dueAtOf(day: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T23:59:59.000Z` : null;
}

export type AssignmentFormProps = {
  readonly roles?: readonly string[] | undefined;
  readonly pending: boolean;
  readonly onSubmit: (
    body: { audience: Readonly<Record<string, unknown>>; due_at: string | null },
    reset: () => void,
  ) => void;
};

const AUDIENCES = ["role", "grade_min", "learner"] as const;

export function AssignmentForm({ roles, pending, onSubmit }: AssignmentFormProps) {
  const { t } = useAdmin();
  const [draft, setDraft] = useState<AudienceDraft>({ type: "role", value: "" });
  const [due, setDue] = useState("");
  const audience = audienceBody(draft);
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (audience !== null)
      onSubmit({ audience, due_at: dueAtOf(due) }, () => {
        setDraft((current) => (current === draft ? { type: draft.type, value: "" } : current));
      });
  };
  return (
    <form className="el-admin-inline-form" onSubmit={submit} aria-label={t.t("assign.add")}>
      <AudienceFields draft={draft} onChange={setDraft} types={AUDIENCES} roles={roles} />
      <TextField label={t.t("field.dueAt")} type="date" value={due} onChange={setDue} />
      <button type="submit" className="el-button" disabled={audience === null || pending}>
        {t.t("assign.add")}
      </button>
    </form>
  );
}

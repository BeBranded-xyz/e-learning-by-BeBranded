"use client";

import type { ApiAudience } from "@bebranded/elearning-core";
import { useId } from "react";

import { useAdmin } from "../provider/admin-context.js";
import { SelectField } from "./Fields.js";

type AudienceType = ApiAudience["type"];

export type AudienceDraft = { readonly type: AudienceType; readonly value: string };

/** The request body of an audience; null while the value is missing or invalid. */
export function audienceBody(draft: AudienceDraft): Readonly<Record<string, unknown>> | null {
  const value = draft.value.trim();
  if (draft.type === "everyone") return { type: "everyone" };
  if (value === "") return null;
  if (draft.type === "role") return { type: "role", role: value };
  if (draft.type === "learner") return { type: "learner", learner_id: value };
  const grade = Number(value);
  return Number.isInteger(grade) && grade >= 0 ? { type: "grade_min", grade } : null;
}

export type AudienceFieldsProps = {
  readonly draft: AudienceDraft;
  readonly onChange: (draft: AudienceDraft) => void;
  /** Assignments have no "everyone" audience. */
  readonly types: readonly AudienceType[];
  /** Host roles suggested in the role field (spec 05: the host may list them). */
  readonly roles?: readonly string[] | undefined;
};

const VALUE_LABELS = {
  role: "field.role",
  grade_min: "field.grade",
  learner: "field.learnerId",
} as const;

export function AudienceFields({ draft, onChange, types, roles }: AudienceFieldsProps) {
  const { t } = useAdmin();
  const id = useId();
  const suggestions = draft.type === "role" && roles !== undefined ? `${id}-roles` : undefined;
  return (
    <>
      <SelectField
        label={t.t("field.audience")}
        value={draft.type}
        options={types.map((type) => ({ value: type, label: t.t(`audience.type.${type}`) }))}
        onChange={(type) => {
          onChange({ type, value: "" });
        }}
      />
      {draft.type === "everyone" ? null : (
        <>
          <label htmlFor={`${id}-value`}>{t.t(VALUE_LABELS[draft.type])}</label>
          <input
            id={`${id}-value`}
            value={draft.value}
            inputMode={draft.type === "grade_min" ? "numeric" : undefined}
            list={suggestions}
            onChange={(event) => {
              onChange({ type: draft.type, value: event.target.value });
            }}
          />
          {suggestions === undefined ? null : (
            <datalist id={suggestions}>
              {roles?.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
          )}
        </>
      )}
    </>
  );
}

/** How an audience reads in a list. */
export function useAudienceLabel() {
  const { t } = useAdmin();
  return (audience: ApiAudience): string => {
    switch (audience.type) {
      case "everyone":
        return t.t("audience.everyone");
      case "role":
        return t.t("audience.role", { role: audience.role });
      case "grade_min":
        return t.t("audience.grade_min", { grade: audience.grade });
      case "learner":
        return t.t("audience.learner", { id: audience.learner_id });
    }
  };
}

"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";

import { useAdmin } from "../provider/admin-context.js";
import { AudienceFields, audienceBody } from "./AudienceFields.js";
import type { AudienceDraft } from "./AudienceFields.js";
import { SelectField } from "./Fields.js";

export type RuleFormProps = {
  readonly roles?: readonly string[] | undefined;
  readonly pending: boolean;
  readonly onSubmit: (
    rule: { effect: "allow" | "deny"; audience: Readonly<Record<string, unknown>> },
    reset: () => void,
  ) => void;
};

const AUDIENCES = ["everyone", "role", "grade_min", "learner"] as const;

/** A new audience rule; "everyone" first, as spec 05 suggests for a new course. */
export function RuleForm({ roles, pending, onSubmit }: RuleFormProps) {
  const { t } = useAdmin();
  const [effect, setEffect] = useState<"allow" | "deny">("allow");
  const [draft, setDraft] = useState<AudienceDraft>({ type: "everyone", value: "" });
  const audience = audienceBody(draft);
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (audience !== null)
      onSubmit({ effect, audience }, () => {
        setDraft({ type: "everyone", value: "" });
      });
  };
  return (
    <form className="el-admin-inline-form" onSubmit={submit} aria-label={t.t("rules.add")}>
      <SelectField
        label={t.t("field.effect")}
        value={effect}
        options={(["allow", "deny"] as const).map((value) => ({
          value,
          label: t.t(`effect.${value}`),
        }))}
        onChange={setEffect}
      />
      <AudienceFields draft={draft} onChange={setDraft} types={AUDIENCES} roles={roles} />
      <button type="submit" className="el-button" disabled={audience === null || pending}>
        {t.t("rules.add")}
      </button>
    </form>
  );
}

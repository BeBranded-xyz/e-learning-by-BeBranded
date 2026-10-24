"use client";

import type { ApiAccessRule } from "@bebranded/elearning-core";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { useAudienceLabel } from "./AudienceFields.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { RuleForm } from "./RuleForm.js";
import { useUi } from "@bebranded/elearning-react";

export type AccessRulesEditorProps = {
  readonly courseId: string;
  readonly targetType: "course" | "chapter" | "lesson";
  readonly targetId: string;
  /** Every rule of the course tree; the editor shows those of its target. */
  readonly rules: readonly ApiAccessRule[];
  readonly roles?: readonly string[] | undefined;
  readonly editable: boolean;
};

/** Audience rules of one course, chapter or lesson (spec 05): deny always wins. */
export function AccessRulesEditor(props: AccessRulesEditorProps) {
  const { Button } = useUi();
  const { t } = useAdmin();
  const label = useAudienceLabel();
  const add = useCourseMutation(props.courseId, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.createAccessRule(body),
  );
  const remove = useCourseMutation(props.courseId, (admin, id: string) =>
    admin.deleteAccessRule(id),
  );
  const rules = props.rules.filter((rule) => rule.target_id === props.targetId);
  const describe = (rule: ApiAccessRule) =>
    `${t.t(`effect.${rule.effect}`)}: ${label(rule.audience)}`;
  return (
    <div className="el-admin-rules">
      {rules.length === 0 ? <p className="el-meta">{t.t("rules.none")}</p> : null}
      <ul>
        {rules.map((rule) => (
          <li key={rule.id} data-effect={rule.effect}>
            <span>{describe(rule)}</span>
            {props.editable ? (
              <Button
                aria-label={t.t("rules.remove", { rule: describe(rule) })}
                onClick={() => {
                  remove.mutate(rule.id);
                }}
              >
                {t.t("action.delete")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {props.editable ? (
        <RuleForm
          roles={props.roles}
          pending={add.isPending}
          onSubmit={(rule, reset) => {
            add.mutate(
              { target_type: props.targetType, target_id: props.targetId, ...rule },
              { onSuccess: reset },
            );
          }}
        />
      ) : null}
      <ErrorAlert error={add.error ?? remove.error} />
    </div>
  );
}

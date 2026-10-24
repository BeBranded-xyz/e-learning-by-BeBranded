"use client";
import { CheckboxField, SelectField, TextField } from "../components/Fields.js";
import { useAdmin } from "../provider/admin-context.js";
import type { SettingField } from "./lesson-setting-fields.js";

function SettingInput({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  const { t } = useAdmin();
  if (field.kind === "boolean")
    return <CheckboxField label={t.t(field.label)} checked={value === true} onChange={onChange} />;
  const displayed =
    field.percent && value !== "" ? String(Math.round(Number(value) * 100)) : String(value);
  return (
    <TextField
      label={t.t(field.label)}
      type="number"
      min={field.min}
      max={field.max}
      required={!field.nullable}
      value={displayed}
      onChange={(value) => {
        onChange(field.percent && value !== "" ? String(Number(value) / 100) : value);
      }}
    />
  );
}

type Props = {
  fields: readonly SettingField[];
  draft: Readonly<Record<string, string | boolean>>;
  quiz: boolean;
  onChange: (key: string, value: string | boolean) => void;
};
export function ValidationFields({ fields, draft, quiz, onChange }: Props) {
  const { t } = useAdmin();
  return (
    <>
      {fields.map((field) => (
        <SettingInput
          key={field.key}
          field={field}
          value={draft[field.key] ?? ""}
          onChange={(value) => {
            onChange(field.key, value);
          }}
        />
      ))}
      {quiz ? (
        <SelectField
          label={t.t("validation.corrections")}
          value={String(draft.showCorrection)}
          options={(["never", "after_attempt", "after_pass"] as const).map((value) => ({
            value,
            label: t.t(`correction.${value}`),
          }))}
          onChange={(value) => {
            onChange("showCorrection", value);
          }}
        />
      ) : null}
    </>
  );
}

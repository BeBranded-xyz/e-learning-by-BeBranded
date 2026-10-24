"use client";

import { useAdmin } from "../provider/admin-context.js";
import { TextField, SelectField } from "./Fields.js";
import { LanguageField } from "./LanguageField.js";

export type CourseDraft = {
  title: string;
  slug: string | null;
  summary: string;
  locale: string;
  enrollment_mode: "self" | "assignment_only";
};
export const emptyCourseDraft = (locale: string): CourseDraft => ({
  title: "",
  slug: null,
  summary: "",
  locale: locale.slice(0, 2),
  enrollment_mode: "self",
});

type Props = {
  disabled: boolean;
  draft: CourseDraft;
  slug: string;
  onChange: (patch: Partial<CourseDraft>) => void;
  showSettings: boolean;
};
export function CourseCreationFields({ draft, slug, onChange, showSettings, disabled }: Props) {
  const { t } = useAdmin();
  return (
    <>
      <TextField
        disabled={disabled}
        label={t.t("field.title")}
        required
        maxLength={200}
        value={draft.title}
        onChange={(title) => {
          onChange({ title });
        }}
      />
      <TextField
        disabled={disabled}
        label={t.t("field.slug")}
        required
        maxLength={100}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        value={slug}
        onChange={(slug) => {
          onChange({ slug });
        }}
      />
      {showSettings ? (
        <CreationSettings draft={draft} onChange={onChange} disabled={disabled} />
      ) : null}
    </>
  );
}

function CreationSettings({
  draft,
  onChange,
  disabled,
}: Pick<Props, "draft" | "onChange" | "disabled">) {
  const { t } = useAdmin();
  return (
    <>
      <TextField
        disabled={disabled}
        label={t.t("field.summary")}
        multiline
        maxLength={2000}
        value={draft.summary}
        onChange={(summary) => {
          onChange({ summary });
        }}
      />
      <LanguageField
        disabled={disabled}
        value={draft.locale}
        onChange={(locale) => {
          onChange({ locale });
        }}
      />
      <SelectField
        disabled={disabled}
        label={t.t("field.enrollmentMode")}
        value={draft.enrollment_mode}
        options={(["self", "assignment_only"] as const).map((value) => ({
          value,
          label: t.t(`enrollment.${value}`),
        }))}
        onChange={(enrollment_mode) => {
          onChange({ enrollment_mode });
        }}
      />
    </>
  );
}

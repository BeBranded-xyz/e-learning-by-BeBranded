"use client";

import { useMemo } from "react";
import { languageOptions } from "../lib/languages.js";
import { useAdmin } from "../provider/admin-context.js";
import { SelectField } from "./Fields.js";

export function LanguageField({
  value,
  onChange,
  disabled,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}) {
  const { t } = useAdmin();
  const options = useMemo(() => languageOptions(t.locale, value), [t.locale, value]);
  return (
    <SelectField
      label={t.t("field.locale")}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
    />
  );
}

import { useId } from "react";

import type {
  UiCheckboxProps,
  UiSelectProps,
  UiTextAreaProps,
  UiTextFieldProps,
} from "./kit.types.js";

// Labels are always visible and programmatically linked (WCAG 1.3.1, 2.5.3).

export function DefaultTextField({ label, onChange, id, ...input }: UiTextFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <>
      <label htmlFor={inputId}>{label}</label>
      <input
        {...input}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </>
  );
}

export function DefaultTextArea({ label, onChange, id, ...textarea }: UiTextAreaProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <>
      <label htmlFor={inputId}>{label}</label>
      <textarea
        {...textarea}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </>
  );
}

export function DefaultSelect({ label, onChange, options, id, ...select }: UiSelectProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <>
      <label htmlFor={inputId}>{label}</label>
      <select
        {...select}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}

/** A checkbox inside its label, so the whole text is the click target. */
export function DefaultCheckbox({ label, onChange, ...checkbox }: UiCheckboxProps) {
  return (
    <label className="el-check">
      <input
        {...checkbox}
        type="checkbox"
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}

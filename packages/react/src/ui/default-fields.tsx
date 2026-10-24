import { useId } from "react";

import type {
  UiCheckboxProps,
  UiSelectProps,
  UiTextAreaProps,
  UiTextFieldProps,
} from "./kit.types.js";

// Labels are always visible and programmatically linked (WCAG 1.3.1, 2.5.3).
// Each field is one box (`el-field`), its label above the control.

export function DefaultTextField({ label, onChange, id, ...input }: UiTextFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="el-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...input}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

export function DefaultTextArea({ label, onChange, id, ...textarea }: UiTextAreaProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="el-field">
      <label htmlFor={inputId}>{label}</label>
      <textarea
        {...textarea}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

export function DefaultSelect({ label, onChange, options, id, ...select }: UiSelectProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="el-field">
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
    </div>
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

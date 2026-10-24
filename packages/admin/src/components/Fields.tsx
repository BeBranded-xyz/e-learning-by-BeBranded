"use client";

import { useId } from "react";

type Common = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean | undefined;
};

export type TextFieldProps = Common & {
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly type?: "text" | "date" | "number";
  readonly multiline?: boolean;
  readonly min?: number;
  readonly max?: number;
};

/** A labelled input; the label is always visible and programmatically linked (WCAG). */
export function TextField({ label, onChange, multiline = false, ...input }: TextFieldProps) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          {...input}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : (
        <input
          id={id}
          {...input}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </>
  );
}

export type SelectFieldProps<V extends string> = Omit<Common, "value" | "onChange"> & {
  readonly value: V;
  readonly onChange: (value: V) => void;
  readonly options: readonly { readonly value: V; readonly label: string }[];
};

/** A labelled select; `onChange` only ever receives one of the options. */
export function SelectField<V extends string>({
  label,
  options,
  onChange,
  ...select
}: SelectFieldProps<V>) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        {...select}
        onChange={(event) => {
          const option = options.find((entry) => entry.value === event.target.value);
          if (option !== undefined) onChange(option.value);
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

export type MoveButtonsProps = {
  readonly disabled: boolean;
  readonly onMove: (delta: -1 | 1) => void;
  readonly labels: { readonly up: string; readonly down: string };
};

/** The keyboard way to reorder: one place up or down. */
export function MoveButtons({ disabled, onMove, labels }: MoveButtonsProps) {
  return (
    <>
      <button
        type="button"
        className="el-button"
        disabled={disabled}
        aria-label={labels.up}
        onClick={() => {
          onMove(-1);
        }}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        type="button"
        className="el-button"
        disabled={disabled}
        aria-label={labels.down}
        onClick={() => {
          onMove(1);
        }}
      >
        <span aria-hidden="true">↓</span>
      </button>
    </>
  );
}

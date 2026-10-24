"use client";

import { useUi } from "@bebranded/elearning-react";

// The back-office's fields, drawn by the provider's UI kit (spec 11). They keep
// the admin's own API (multiline text, typed select values) over the kit's.

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

/** A labelled input or text area; the label is always visible and programmatically linked. */
export function TextField({
  multiline = false,
  pattern,
  type,
  min,
  max,
  ...field
}: TextFieldProps) {
  const { TextArea, TextField: Input } = useUi();
  return multiline ? (
    <TextArea {...field} />
  ) : (
    <Input {...field} pattern={pattern} type={type} min={min} max={max} />
  );
}

export type SelectFieldProps<V extends string> = Omit<Common, "value" | "onChange"> & {
  readonly value: V;
  readonly onChange: (value: V) => void;
  readonly options: readonly { readonly value: V; readonly label: string }[];
};

/** A labelled select; `onChange` only ever receives one of the options. */
export function SelectField<V extends string>({
  options,
  onChange,
  ...select
}: SelectFieldProps<V>) {
  const { Select } = useUi();
  return (
    <Select
      {...select}
      options={options}
      onChange={(value) => {
        const option = options.find((entry) => entry.value === value);
        if (option !== undefined) onChange(option.value);
      }}
    />
  );
}

export type MoveButtonsProps = {
  readonly disabled: boolean;
  readonly onMove: (delta: -1 | 1) => void;
  readonly labels: { readonly up: string; readonly down: string };
};

/** The keyboard way to reorder: one place up or down. */
export function MoveButtons({ disabled, onMove, labels }: MoveButtonsProps) {
  const { Button } = useUi();
  return (
    <>
      <Button
        size="sm"
        disabled={disabled}
        aria-label={labels.up}
        onClick={() => {
          onMove(-1);
        }}
      >
        <span aria-hidden="true">↑</span>
      </Button>
      <Button
        size="sm"
        disabled={disabled}
        aria-label={labels.down}
        onClick={() => {
          onMove(1);
        }}
      >
        <span aria-hidden="true">↓</span>
      </Button>
    </>
  );
}

export type CheckboxFieldProps = {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean | undefined;
};

/** A labelled checkbox. */
export function CheckboxField(props: CheckboxFieldProps) {
  const { Checkbox } = useUi();
  return <Checkbox {...props} />;
}

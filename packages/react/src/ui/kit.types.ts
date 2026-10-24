import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentType,
  HTMLAttributes,
  ReactNode,
} from "react";

// The UI kit (spec 11): the primitives the module draws. A kit draws; the module
// decides labels, ARIA, focus and live regions and passes them in. Every primitive
// forwards the HTML attributes it receives (id, aria-*, data-*, handlers).

type Native<T> = Omit<T, "className" | "style" | "color">;

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md";

export type UiButtonProps = Native<ButtonHTMLAttributes<HTMLButtonElement>> & {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly type?: "button" | "submit" | undefined;
};

export type UiLinkButtonProps = Native<AnchorHTMLAttributes<HTMLAnchorElement>> & {
  readonly href: string;
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
};

export type UiCardProps = Native<HTMLAttributes<HTMLElement>> & {
  readonly as?: "article" | "section" | "div" | "li" | undefined;
};

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "destructive";

export type UiBadgeProps = Native<HTMLAttributes<HTMLSpanElement>> & {
  readonly tone?: BadgeTone | undefined;
};

export type UiAlertProps = Native<HTMLAttributes<HTMLDivElement>> & {
  readonly tone: "info" | "success" | "warning" | "error";
};

export type UiProgressProps = {
  /** Between 0 and 1. */
  readonly value: number;
  /** The accessible name. */
  readonly label: string;
  /** The value as people read it, e.g. "40%"; shown and announced. */
  readonly valueText: string;
};

type FieldCommon = {
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
};

export type UiTextFieldProps = FieldCommon & {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: "text" | "date" | "number" | "email" | undefined;
  readonly required?: boolean | undefined;
  readonly maxLength?: number | undefined;
  readonly pattern?: string | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly placeholder?: string | undefined;
  /** The id of a `<datalist>` whose options the field suggests. */
  readonly list?: string | undefined;
  readonly inputMode?: "text" | "numeric" | undefined;
};

export type UiTextAreaProps = FieldCommon & {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean | undefined;
  readonly maxLength?: number | undefined;
  readonly rows?: number | undefined;
};

export type UiSelectProps = FieldCommon & {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly value: string; readonly label: string }[];
};

export type UiCheckboxProps = FieldCommon & {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
};

export type UiTableProps = {
  readonly caption: string;
  readonly columns: readonly { readonly key: string; readonly header: ReactNode }[];
  /** The first cell of each row is its header (`<th scope="row">`). */
  readonly rows: readonly { readonly key: string; readonly cells: readonly ReactNode[] }[];
};

export type UiKit = {
  readonly Button: ComponentType<UiButtonProps>;
  readonly LinkButton: ComponentType<UiLinkButtonProps>;
  readonly Card: ComponentType<UiCardProps>;
  readonly Badge: ComponentType<UiBadgeProps>;
  readonly Alert: ComponentType<UiAlertProps>;
  readonly Progress: ComponentType<UiProgressProps>;
  readonly TextField: ComponentType<UiTextFieldProps>;
  readonly TextArea: ComponentType<UiTextAreaProps>;
  readonly Select: ComponentType<UiSelectProps>;
  readonly Checkbox: ComponentType<UiCheckboxProps>;
  readonly Table: ComponentType<UiTableProps>;
};

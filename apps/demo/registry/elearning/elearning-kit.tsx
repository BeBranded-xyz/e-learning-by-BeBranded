"use client";

import type {
  BadgeTone,
  ButtonSize,
  ButtonVariant,
  UiAlertProps,
  UiBadgeProps,
  UiButtonProps,
  UiCardProps,
  UiCheckboxProps,
  UiKit,
  UiLinkButtonProps,
  UiProgressProps,
  UiSelectProps,
  UiTableProps,
  UiTextAreaProps,
  UiTextFieldProps,
} from "@bebranded/elearning-react";
import { useId } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/**
 * The e-learning module's UI kit drawn with shadcn/ui (spec 11, theme 1).
 * Pass it to the provider: `<ElearningProvider design={design} ui={elearningKit}>`.
 * The module decides labels, ARIA and live regions; this file only draws.
 */

const VARIANTS = {
  primary: "default",
  secondary: "outline",
  destructive: "destructive",
  ghost: "ghost",
} as const satisfies Record<ButtonVariant, string>;
const SIZES = { sm: "sm", md: "default" } as const satisfies Record<ButtonSize, string>;

function KitButton({
  variant = "secondary",
  size = "md",
  type = "button",
  ...button
}: UiButtonProps) {
  return <Button {...button} type={type} variant={VARIANTS[variant]} size={SIZES[size]} />;
}

function KitLinkButton({
  variant = "secondary",
  size = "md",
  children,
  ...link
}: UiLinkButtonProps) {
  return (
    <Button asChild variant={VARIANTS[variant]} size={SIZES[size]}>
      <a {...link}>{children}</a>
    </Button>
  );
}

// The wrapper fills its grid cell too, so the cards of a row share one height.
function KitCard({ as: Tag = "div", children, ...card }: UiCardProps) {
  return (
    <Tag {...card} className="h-full">
      <Card className="h-full gap-3 px-6 py-5">{children}</Card>
    </Tag>
  );
}

const BADGES: Record<
  BadgeTone,
  { variant: "secondary" | "outline" | "destructive" | "default"; className?: string }
> = {
  neutral: { variant: "secondary" },
  info: { variant: "outline" },
  success: {
    variant: "default",
    className: "border-transparent bg-success text-success-foreground",
  },
  warning: {
    variant: "default",
    className: "border-transparent bg-warning text-warning-foreground",
  },
  destructive: { variant: "destructive" },
};

function KitBadge({ tone = "neutral", ...badge }: UiBadgeProps) {
  return <Badge {...badge} {...BADGES[tone]} />;
}

const ALERT_CLASSES = {
  info: "",
  success: "text-success",
  warning: "text-warning",
  error: "",
} as const;

function KitAlert({ tone, role, children, ...alert }: UiAlertProps) {
  // shadcn's Alert says role="alert"; the module decides: none, "status" or "alert".
  return (
    <Alert
      {...alert}
      role={role}
      variant={tone === "error" ? "destructive" : "default"}
      className={ALERT_CLASSES[tone]}
    >
      <AlertDescription className={tone === "info" ? undefined : "text-current"}>
        {children}
      </AlertDescription>
    </Alert>
  );
}

function KitProgress({ value, label, valueText }: UiProgressProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="flex items-center gap-3">
      <Progress
        value={percent}
        aria-label={label}
        getValueLabel={() => valueText}
        className="flex-1"
      />
      <span className="text-sm text-muted-foreground tabular-nums" aria-hidden="true">
        {valueText}
      </span>
    </div>
  );
}

function useFieldId(id: string | undefined): string {
  const generated = useId();
  return id ?? generated;
}

function KitTextField({ label, onChange, id, ...input }: UiTextFieldProps) {
  const inputId = useFieldId(id);
  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        {...input}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

function KitTextArea({ label, onChange, id, ...textarea }: UiTextAreaProps) {
  const inputId = useFieldId(id);
  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Textarea
        {...textarea}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

function KitSelect({ label, onChange, options, id, ...select }: UiSelectProps) {
  const inputId = useFieldId(id);
  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <NativeSelect
        {...select}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function KitCheckbox({ label, checked, onChange, id, disabled }: UiCheckboxProps) {
  const inputId = useFieldId(id);
  return (
    <div className="flex items-center gap-2">
      {/* 24px, the WCAG 2.2 minimum target (2.5.8), whatever the spacing around it. */}
      <Checkbox
        id={inputId}
        className="size-6"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(state) => {
          onChange(state === true);
        }}
      />
      <Label htmlFor={inputId}>{label}</Label>
    </div>
  );
}

function KitTable({ caption, columns, rows }: UiTableProps) {
  return (
    <Table>
      <TableCaption className="caption-top text-left font-medium text-foreground">
        {caption}
      </TableCaption>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} scope="col">
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            {row.cells.map((cell, index) =>
              index === 0 ? (
                <TableHead key={columns[index]?.key ?? index} scope="row" className="font-normal">
                  {cell}
                </TableHead>
              ) : (
                <TableCell key={columns[index]?.key ?? index}>{cell}</TableCell>
              ),
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export const elearningKit: UiKit = {
  Button: KitButton,
  LinkButton: KitLinkButton,
  Card: KitCard,
  Badge: KitBadge,
  Alert: KitAlert,
  Progress: KitProgress,
  TextField: KitTextField,
  TextArea: KitTextArea,
  Select: KitSelect,
  Checkbox: KitCheckbox,
  Table: KitTable,
};

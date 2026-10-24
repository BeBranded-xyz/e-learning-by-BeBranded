"use client";

import { useElearning } from "../provider/context.js";
import { useUi } from "../ui/kit.js";

export type ProgressBarProps = {
  /** Between 0 and 1. */
  readonly ratio: number;
  /** Accessible name; defaults to "Progress". */
  readonly label?: string;
};

/** The kit's progress bar, labelled and with its value as a percentage. */
export function ProgressBar({ ratio, label }: ProgressBarProps) {
  const { i18n } = useElearning();
  const { Progress } = useUi();
  const value = Math.min(1, Math.max(0, ratio));
  return (
    <Progress
      value={value}
      label={label ?? i18n.t("progress.label")}
      valueText={i18n.formatPercent(value)}
    />
  );
}

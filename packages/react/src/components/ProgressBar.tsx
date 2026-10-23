"use client";

import { useElearning } from "../provider/context.js";

export type ProgressBarProps = {
  /** Between 0 and 1. */
  readonly ratio: number;
  /** Accessible name; defaults to "Progress". */
  readonly label?: string;
};

/** Native <progress>: announced by screen readers with its value. */
export function ProgressBar({ ratio, label }: ProgressBarProps) {
  const { i18n } = useElearning();
  const value = Math.min(1, Math.max(0, ratio));
  return (
    <div className="el-progress">
      <progress
        className="el-progress-bar"
        max={1}
        value={value}
        aria-label={label ?? i18n.t("progress.label")}
      />
      <span className="el-progress-value" aria-hidden="true">
        {i18n.formatPercent(value)}
      </span>
    </div>
  );
}

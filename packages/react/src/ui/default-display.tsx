import type { UiAlertProps, UiBadgeProps, UiCardProps, UiProgressProps } from "./kit.types.js";

export function DefaultCard({ as: Tag = "div", ...card }: UiCardProps) {
  return <Tag {...card} className="el-card" />;
}

export function DefaultBadge({ tone = "neutral", ...badge }: UiBadgeProps) {
  return <span {...badge} className="el-tag" data-tone={tone} />;
}

const ALERT_CLASSES = {
  info: "el-state",
  success: "el-state el-state-success",
  warning: "el-state el-state-warning",
  error: "el-state el-state-error",
} as const;

export function DefaultAlert({ tone, ...alert }: UiAlertProps) {
  return <div {...alert} className={ALERT_CLASSES[tone]} />;
}

/** Native <progress>: announced with its value; the text is visual only. */
export function DefaultProgress({ value, label, valueText }: UiProgressProps) {
  const ratio = Math.min(1, Math.max(0, value));
  return (
    <div className="el-progress">
      <progress
        className="el-progress-bar"
        max={1}
        value={ratio}
        aria-label={label}
        aria-valuetext={valueText}
      />
      <span className="el-progress-value" aria-hidden="true">
        {valueText}
      </span>
    </div>
  );
}

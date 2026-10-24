import type { AdminMessageKey } from "../i18n/admin-messages.js";

export type SettingField = {
  key: string;
  label: AdminMessageKey;
  kind: "number" | "boolean";
  min?: number;
  max?: number;
  percent?: boolean;
  nullable?: boolean;
};

export const textFields: readonly SettingField[] = [
  { key: "requireScrollToEnd", label: "validation.scroll", kind: "boolean" },
];
export const videoFields: readonly SettingField[] = [
  {
    key: "completionThreshold",
    label: "validation.videoPercent",
    kind: "number",
    min: 50,
    max: 100,
    percent: true,
  },
  { key: "maxPlaybackRate", label: "validation.speed", kind: "number", min: 1, max: 4 },
  { key: "allowSeeking", label: "validation.seeking", kind: "boolean" },
  { key: "pauseWhenHidden", label: "validation.pauseHidden", kind: "boolean" },
];
export const quizFields: readonly SettingField[] = [
  {
    key: "passingScore",
    label: "validation.passingScore",
    kind: "number",
    min: 0,
    max: 100,
    percent: true,
  },
  {
    key: "maxAttempts",
    label: "validation.attempts",
    kind: "number",
    min: 1,
    max: 100,
    nullable: true,
  },
  { key: "cooldownMinutes", label: "validation.cooldown", kind: "number", min: 0, max: 10080 },
  {
    key: "timeLimitMinutes",
    label: "validation.timeLimit",
    kind: "number",
    min: 1,
    max: 600,
    nullable: true,
  },
  { key: "shuffleQuestions", label: "validation.shuffleQuestions", kind: "boolean" },
  { key: "shuffleOptions", label: "validation.shuffleOptions", kind: "boolean" },
];

import type { Color } from "@bebranded/elearning-core";

/** BlockNote's color names as Word hex colors (text and highlight), readable on white. */
const TEXT_COLORS: Record<Exclude<Color, "default">, string> = {
  gray: "6B7280",
  brown: "92400E",
  red: "B91C1C",
  orange: "C2410C",
  yellow: "A16207",
  green: "15803D",
  blue: "1D4ED8",
  purple: "7E22CE",
  pink: "BE185D",
};

const BACKGROUND_COLORS: Record<Exclude<Color, "default">, string> = {
  gray: "F3F4F6",
  brown: "F5EBE0",
  red: "FEE2E2",
  orange: "FFEDD5",
  yellow: "FEF9C3",
  green: "DCFCE7",
  blue: "DBEAFE",
  purple: "F3E8FF",
  pink: "FCE7F3",
};

export const textColor = (color: Color | undefined) =>
  color === undefined || color === "default" ? undefined : TEXT_COLORS[color];

export const backgroundColor = (color: Color | undefined) =>
  color === undefined || color === "default" ? undefined : BACKGROUND_COLORS[color];

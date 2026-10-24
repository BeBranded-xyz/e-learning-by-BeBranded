import type { DesignColors } from "../../src/design/design.types.js";

// Synthetic palettes for the design tests: neutral, readable in both schemes.

export const LIGHT: DesignColors = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  primary: "#171717",
  primaryForeground: "#fafafa",
  secondary: "#f5f5f5",
  secondaryForeground: "#171717",
  muted: "#f5f5f5",
  mutedForeground: "#595959",
  accent: "#f5f5f5",
  accentForeground: "#171717",
  destructive: "#b91c1c",
  destructiveForeground: "#ffffff",
  success: "#15803d",
  successForeground: "#ffffff",
  warning: "#a16207",
  warningForeground: "#ffffff",
  border: "#e5e5e5",
  input: "#e5e5e5",
  ring: "#a3a3a3",
};

export const DARK: Partial<DesignColors> = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  cardForeground: "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  primaryForeground: "oklch(0.205 0 0)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.985 0 0)",
};

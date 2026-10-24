import { defineDesign } from "@bebranded/elearning-core/design";
import type { DesignColors } from "@bebranded/elearning-core/design";

// A synthetic, readable palette for the provider and kit tests.
const LIGHT: DesignColors = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  primary: "#654321",
  primaryForeground: "#ffffff",
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

export const testDesign = defineDesign({ colors: { light: LIGHT } });

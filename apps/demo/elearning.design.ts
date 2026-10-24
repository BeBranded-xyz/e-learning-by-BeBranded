import { defineDesign } from "@bebranded/elearning-core/design";

/**
 * The demo's design file (spec 11): the one place its colors, fonts and radius
 * are decided. The module, the back-office and the exports all read it.
 */
export const design = defineDesign({
  brand: { name: "Acme Corp training" },
  colors: {
    light: {
      background: "#ffffff",
      foreground: "#111827",
      card: "#f7f7f9",
      cardForeground: "#111827",
      primary: "#4338ca",
      primaryForeground: "#ffffff",
      secondary: "#f3f4f6",
      secondaryForeground: "#111827",
      muted: "#f3f4f6",
      mutedForeground: "#4b5563",
      accent: "#eef2ff",
      accentForeground: "#312e81",
      destructive: "#b91c1c",
      destructiveForeground: "#ffffff",
      success: "#15803d",
      successForeground: "#ffffff",
      warning: "#a16207",
      warningForeground: "#ffffff",
      border: "#d1d5db",
      input: "#d1d5db",
      ring: "#4338ca",
    },
  },
  radius: "0.625rem",
});

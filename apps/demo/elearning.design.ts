import { defineDesign } from "@bebranded/elearning-core/design";

/**
 * The demo's design file (spec 11): the only place its colors, fonts,
 * radius and spacing are decided. The shell (Tailwind and shadcn/ui), the module, the
 * back-office and the PDF and Word exports all read it. The palette is
 * shadcn/ui's "neutral", with muted text darkened to pass WCAG AA on muted
 * surfaces, and success and warning tokens added.
 */
export const design = defineDesign({
  brand: { name: "Acme Corp training" },
  colors: {
    light: {
      background: "oklch(1 0 0)",
      foreground: "oklch(0.145 0 0)",
      card: "oklch(1 0 0)",
      cardForeground: "oklch(0.145 0 0)",
      primary: "oklch(0.205 0 0)",
      primaryForeground: "oklch(0.985 0 0)",
      secondary: "oklch(0.97 0 0)",
      secondaryForeground: "oklch(0.205 0 0)",
      muted: "oklch(0.97 0 0)",
      mutedForeground: "oklch(0.5 0 0)",
      accent: "oklch(0.97 0 0)",
      accentForeground: "oklch(0.205 0 0)",
      destructive: "oklch(0.55 0.22 27)",
      destructiveForeground: "oklch(0.985 0 0)",
      success: "oklch(0.5 0.13 150)",
      successForeground: "oklch(0.985 0 0)",
      warning: "oklch(0.55 0.13 70)",
      warningForeground: "oklch(0.985 0 0)",
      border: "oklch(0.922 0 0)",
      input: "oklch(0.922 0 0)",
      ring: "oklch(0.708 0 0)",
    },
    dark: {
      background: "oklch(0.145 0 0)",
      foreground: "oklch(0.985 0 0)",
      card: "oklch(0.205 0 0)",
      cardForeground: "oklch(0.985 0 0)",
      primary: "oklch(0.922 0 0)",
      primaryForeground: "oklch(0.205 0 0)",
      secondary: "oklch(0.269 0 0)",
      secondaryForeground: "oklch(0.985 0 0)",
      muted: "oklch(0.269 0 0)",
      mutedForeground: "oklch(0.75 0 0)",
      accent: "oklch(0.269 0 0)",
      accentForeground: "oklch(0.985 0 0)",
      destructive: "oklch(0.7 0.19 22)",
      destructiveForeground: "oklch(0.145 0 0)",
      success: "oklch(0.75 0.15 150)",
      successForeground: "oklch(0.145 0 0)",
      warning: "oklch(0.8 0.14 80)",
      warningForeground: "oklch(0.145 0 0)",
      border: "oklch(0.3 0 0)",
      input: "oklch(0.35 0 0)",
      ring: "oklch(0.556 0 0)",
    },
  },
  radius: "0.625rem",
  // Tailwind's unit: the shell's `p-4` and the module's `--el-space-4` are both 1rem.
  spacing: "0.25rem",
  fonts: {
    body: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  darkMode: "media",
});

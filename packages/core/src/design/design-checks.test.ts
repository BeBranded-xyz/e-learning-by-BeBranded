import { describe, expect, it } from "vitest";

import { DARK, LIGHT } from "../../tests/fixtures/designs.js";
import { defineDesign } from "./design.js";
import { checkDesign, designToExportTheme } from "./design-checks.js";

describe("checkDesign", () => {
  it("finds no warning in a readable design, in both schemes", () => {
    expect(checkDesign(defineDesign({ colors: { light: LIGHT, dark: DARK } }))).toEqual([]);
  });

  it("reports each pair below WCAG AA, with its scheme and ratio", () => {
    const design = defineDesign({
      colors: {
        light: { ...LIGHT, mutedForeground: "#999999" },
        dark: { ...DARK, primaryForeground: "oklch(0.8 0 0)" },
      },
    });

    expect(checkDesign(design)).toEqual([
      { scheme: "light", text: "mutedForeground", background: "background", ratio: 2.85 },
      { scheme: "light", text: "mutedForeground", background: "muted", ratio: 2.61 },
      { scheme: "dark", text: "primaryForeground", background: "primary", ratio: 1.48 },
    ]);
  });

  it("checks only the light scheme of a light design", () => {
    const design = defineDesign({ colors: { light: { ...LIGHT, foreground: "#cccccc" } } });

    expect(checkDesign(design).map((warning) => warning.scheme)).toEqual(["light"]);
  });
});

describe("designToExportTheme", () => {
  it("gives the exports hex colors, fonts and brand", () => {
    const design = defineDesign({
      colors: { light: { ...LIGHT, primary: "oklch(62.8% 0.2577 29.23)" } },
      fonts: { body: "Inter, sans-serif", heading: "Georgia, serif" },
      brand: { name: "Acme Corp training" },
    });

    expect(designToExportTheme(design)).toEqual({
      primaryColor: "#ff0000",
      textColor: "#0a0a0a",
      mutedColor: "#595959",
      borderColor: "#e5e5e5",
      surfaceColor: "#f5f5f5",
      successColor: "#15803d",
      warningColor: "#a16207",
      destructiveColor: "#b91c1c",
      fontFamily: "Inter, sans-serif",
      headingFontFamily: "Georgia, serif",
      brandName: "Acme Corp training",
      logo: null,
    });
  });
});

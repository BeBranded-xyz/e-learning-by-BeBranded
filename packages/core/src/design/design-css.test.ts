import { describe, expect, it } from "vitest";

import { DARK, LIGHT } from "../../tests/fixtures/designs.js";
import { defineDesign } from "./design.js";
import {
  designToModuleCss,
  designToShadcnCss,
  moduleVariables,
  shadcnVariables,
} from "./design-css.js";

const design = defineDesign({
  colors: { light: LIGHT, dark: DARK },
  radius: "0.625rem",
  fonts: { body: "Inter, sans-serif", heading: "Georgia, serif", mono: "Menlo, monospace" },
});

describe("moduleVariables", () => {
  it("names every color --el-color-*, keeps the first names, and adds shape and type", () => {
    const variables = moduleVariables(design, design.colors.light);

    expect(variables).toMatchObject({
      "--el-color-primary": LIGHT.primary,
      "--el-color-primary-foreground": LIGHT.primaryForeground,
      "--el-color-muted-foreground": LIGHT.mutedForeground,
      "--el-color-surface": LIGHT.card,
      "--el-color-text": LIGHT.foreground,
      "--el-color-danger": LIGHT.destructive,
      "--el-radius": "0.625rem",
      "--el-font-family": "Inter, sans-serif",
      "--el-font-heading": "Georgia, serif",
      "--el-font-mono": "Menlo, monospace",
    });
    expect(Object.keys(variables)).toHaveLength(21 + 7);
  });
});

describe("shadcnVariables", () => {
  it("uses shadcn/ui's names", () => {
    expect(shadcnVariables(design, design.colors.dark)).toMatchObject({
      "--background": DARK.background,
      "--card-foreground": DARK.cardForeground,
      "--destructive": LIGHT.destructive,
      "--radius": "0.625rem",
      "--font-sans": "Inter, sans-serif",
    });
  });
});

describe("stylesheets", () => {
  it("scopes the module's variables to its root, with dark ones under the system preference", () => {
    const css = designToModuleCss(design);

    expect(css).toMatch(/^\.el-root \{\n {2}--el-color-background: #ffffff;/);
    expect(css).toContain(
      "@media (prefers-color-scheme: dark) {\n.el-root:not(.light, .light *) {",
    );
    expect(css).toContain(`--el-color-background: ${DARK.background ?? ""};`);
  });

  it("puts the shell's variables on :root, dark ones under a .dark class when asked", () => {
    const css = designToShadcnCss({ ...design, darkMode: "class" });

    expect(css).toMatch(/^:root \{\n {2}--background: #ffffff;/);
    expect(css).toContain(".dark :root, :root.dark {");
    expect(css).not.toContain("@media");
  });

  it("writes no dark rules for a light design", () => {
    const light = defineDesign({ colors: { light: LIGHT } });

    expect(designToModuleCss(light)).not.toContain("dark");
    expect(designToShadcnCss(light).match(/\{/g)).toHaveLength(1);
  });
});

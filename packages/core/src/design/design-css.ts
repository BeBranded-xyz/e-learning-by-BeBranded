import { COLOR_TOKENS } from "./design.types.js";
import type { DesignColors, ElearningDesign } from "./design.types.js";

// CSS generated from a validated design (spec 11). Values were checked by
// `defineDesign`, so they can be written into a stylesheet as they are.

const kebab = (token: string) => token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

type Variables = Readonly<Record<string, string>>;

/** The module's variables: every color as `--el-color-*`, plus shape and type. */
export function moduleVariables(design: ElearningDesign, colors: DesignColors): Variables {
  const entries = COLOR_TOKENS.map(
    (token) => [`--el-color-${kebab(token)}`, colors[token]] as const,
  );
  return {
    ...Object.fromEntries(entries),
    // The names the module's stylesheets were first written with.
    "--el-color-surface": colors.card,
    "--el-color-text": colors.foreground,
    "--el-color-danger": colors.destructive,
    "--el-radius": design.radius,
    "--el-font-family": design.fonts.body,
    "--el-font-heading": design.fonts.heading,
    "--el-font-mono": design.fonts.mono,
  };
}

/** shadcn/ui's variables, for the host shell around the module. */
export function shadcnVariables(design: ElearningDesign, colors: DesignColors): Variables {
  const entries = COLOR_TOKENS.map((token) => [`--${kebab(token)}`, colors[token]] as const);
  return {
    ...Object.fromEntries(entries),
    "--radius": design.radius,
    "--font-sans": design.fonts.body,
    "--font-heading": design.fonts.heading,
    "--font-mono": design.fonts.mono,
  };
}

const block = (selector: string, variables: Variables) =>
  `${selector} {\n${Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n")}\n}`;

type Naming = (design: ElearningDesign, colors: DesignColors) => Variables;

/**
 * Light variables on `selector`, dark ones per the design's `darkMode`: under
 * `prefers-color-scheme` (unless the element or an ancestor has `.light`),
 * under a `.dark` ancestor or class, or none.
 */
function stylesheet(design: ElearningDesign, selector: string, naming: Naming): string {
  const light = block(selector, naming(design, design.colors.light));
  const dark = naming(design, design.colors.dark);
  switch (design.darkMode) {
    case "off":
      return light;
    case "class":
      return `${light}\n${block(`.dark ${selector}, ${selector}.dark`, dark)}`;
    case "media":
      return `${light}\n@media (prefers-color-scheme: dark) {\n${block(`${selector}:not(.light, .light *)`, dark)}\n}`;
  }
}

/** The module's stylesheet, scoped to its root element (`<ElearningProvider>` renders it). */
export function designToModuleCss(design: ElearningDesign): string {
  return stylesheet(design, ".el-root", moduleVariables);
}

/** The host shell's stylesheet in shadcn's names, on `:root`. */
export function designToShadcnCss(design: ElearningDesign): string {
  return stylesheet(design, ":root", shadcnVariables);
}

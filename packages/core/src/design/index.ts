// @bebranded/elearning-core/design: the design file (spec 11), a separate entry point.
export { contrastRatio, parseColor, toHex } from "./color.js";
export type { Rgb } from "./color.js";
export { defineDesign } from "./design.js";
export { COLOR_TOKENS } from "./design.types.js";
export type {
  ColorToken,
  DarkMode,
  DesignColors,
  DesignInput,
  ElearningDesign,
} from "./design.types.js";
export {
  designToModuleCss,
  designToShadcnCss,
  moduleVariables,
  shadcnVariables,
} from "./design-css.js";
export { checkDesign, designToExportTheme } from "./design-checks.js";
export type { ContrastWarning, DesignExportTheme } from "./design-checks.js";

import { contrastRatio, parseColor, toHex } from "./color.js";
import type { ColorToken, DesignColors, ElearningDesign } from "./design.types.js";

/** Text and its background, as the module and the shadcn kit pair them. */
const TEXT_PAIRS: readonly (readonly [ColorToken, ColorToken])[] = [
  ["foreground", "background"],
  ["cardForeground", "card"],
  ["mutedForeground", "background"],
  ["mutedForeground", "muted"],
  ["primaryForeground", "primary"],
  ["secondaryForeground", "secondary"],
  ["accentForeground", "accent"],
  ["destructiveForeground", "destructive"],
  ["successForeground", "success"],
  ["warningForeground", "warning"],
];

export type ContrastWarning = {
  readonly scheme: "light" | "dark";
  readonly text: ColorToken;
  readonly background: ColorToken;
  readonly ratio: number;
};

const WCAG_AA = 4.5;

function check(scheme: "light" | "dark", colors: DesignColors): ContrastWarning[] {
  return TEXT_PAIRS.flatMap(([text, background]) => {
    const foreground = parseColor(colors[text]);
    const behind = parseColor(colors[background]);
    if (foreground === null || behind === null) return [];
    const ratio = Math.round(contrastRatio(foreground, behind) * 100) / 100;
    return ratio < WCAG_AA ? [{ scheme, text, background, ratio }] : [];
  });
}

/** Every text pair below WCAG AA (4.5:1), in each color scheme the design uses (spec 11). */
export function checkDesign(design: ElearningDesign): ContrastWarning[] {
  const light = check("light", design.colors.light);
  return design.darkMode === "off" ? light : [...light, ...check("dark", design.colors.dark)];
}

export type DesignExportTheme = {
  readonly primaryColor: string;
  readonly textColor: string;
  readonly mutedColor: string;
  readonly borderColor: string;
  readonly fontFamily: string;
  readonly headingFontFamily: string;
  readonly brandName: string;
  readonly logo: string | null;
};

const hex = (value: string) => {
  const color = parseColor(value);
  // defineDesign accepted only parsable colors.
  return color === null ? "#000000" : toHex(color);
};

/** The light colors as `#rrggbb`, fonts and brand: what the PDF and Word exports read. */
export function designToExportTheme(design: ElearningDesign): DesignExportTheme {
  const colors = design.colors.light;
  return {
    primaryColor: hex(colors.primary),
    textColor: hex(colors.foreground),
    mutedColor: hex(colors.mutedForeground),
    borderColor: hex(colors.border),
    fontFamily: design.fonts.body,
    headingFontFamily: design.fonts.heading,
    brandName: design.brand.name,
    logo: design.brand.logo,
  };
}

/** The color tokens of a design (spec 11): shadcn/ui's vocabulary, so a shadcn host maps one to one. */
export const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "cardForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "destructiveForeground",
  "success",
  "successForeground",
  "warning",
  "warningForeground",
  "border",
  "input",
  "ring",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
export type DesignColors = Readonly<Record<ColorToken, string>>;
export type DarkMode = "media" | "class" | "off";

/** A validated design, every token resolved: what `defineDesign` returns. */
export type ElearningDesign = {
  readonly brand: {
    readonly name: string;
    /** A data URI picture (PNG, JPEG, GIF, WebP) for export covers; exports never fetch. */
    readonly logo: string | null;
  };
  readonly colors: { readonly light: DesignColors; readonly dark: DesignColors };
  readonly radius: string;
  readonly fonts: { readonly body: string; readonly heading: string; readonly mono: string };
  /** `media` follows the system, `class` a `.dark` ancestor, `off` stays light. */
  readonly darkMode: DarkMode;
};

/** What a design file declares: light colors in full, everything else optional. */
export type DesignInput = {
  readonly brand?: { readonly name?: string; readonly logo?: string };
  readonly colors: { readonly light: DesignColors; readonly dark?: Partial<DesignColors> };
  readonly radius?: string;
  readonly fonts?: Partial<ElearningDesign["fonts"]>;
  readonly darkMode?: DarkMode;
};

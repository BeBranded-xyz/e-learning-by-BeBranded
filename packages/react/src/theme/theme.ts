/** Host theme (spec 04, section 6), applied as `--el-*` CSS custom properties. */
export type ElearningTheme = {
  readonly colors?: Partial<
    Record<
      | "primary"
      | "primaryForeground"
      | "background"
      | "surface"
      | "text"
      | "muted"
      | "success"
      | "danger"
      | "border",
      string
    >
  >;
  readonly radius?: string;
  readonly fontFamily?: string;
};

const COLOR_TOKENS = {
  primary: "--el-color-primary",
  primaryForeground: "--el-color-primary-foreground",
  background: "--el-color-background",
  surface: "--el-color-surface",
  text: "--el-color-text",
  muted: "--el-color-muted",
  success: "--el-color-success",
  danger: "--el-color-danger",
  border: "--el-color-border",
} as const;

// Theme values become CSS: only plain colors, lengths and font names pass,
// so a theme can never inject other declarations (`red; background: url(…)`).
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch)a?\([\d\s.,%/+-]+\)|[a-z]+)$/i;
const SAFE_LENGTH = /^\d+(\.\d+)?(px|rem|em|%)$/;
const SAFE_FONT = /^[\w\s,"'-]+$/;

function safe(value: string | undefined, pattern: RegExp): value is string {
  return value !== undefined && pattern.test(value);
}

/** CSS variables for the provider's root element; unsafe values are dropped. */
export function themeToStyle(theme: ElearningTheme | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [name, token] of Object.entries(COLOR_TOKENS)) {
    // Object.entries widens keys to string; they are exactly the keys of COLOR_TOKENS.
    const value = theme?.colors?.[name as keyof typeof COLOR_TOKENS];
    if (safe(value, SAFE_COLOR)) style[token] = value;
  }
  if (safe(theme?.radius, SAFE_LENGTH)) style["--el-radius"] = theme.radius;
  if (safe(theme?.fontFamily, SAFE_FONT)) style["--el-font-family"] = theme.fontFamily;
  return style;
}

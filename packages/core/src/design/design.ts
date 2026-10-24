import { z } from "zod";

import { parseColor } from "./color.js";
import type { DesignColors, DesignInput, ElearningDesign } from "./design.types.js";

// Design values become CSS: only colors, lengths, font names and picture data URIs pass.
const color = z.string().refine((value) => parseColor(value) !== null, {
  message: "must be a color: #hex, rgb(), hsl() or oklch()",
});
const length = z.string().regex(/^\d+(\.\d+)?(px|rem|em)$/, "must be a length in px, rem or em");
const font = z.string().regex(/^[\w\s,"'-]{1,200}$/, "must be a list of font names");
const logo = z
  .string()
  .max(1_000_000)
  .regex(/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/, "must be a picture data URI");

// Spelled out so the schema type is exact; a test checks it lists COLOR_TOKENS.
export const colorsSchema = z.strictObject({
  background: color,
  foreground: color,
  card: color,
  cardForeground: color,
  primary: color,
  primaryForeground: color,
  secondary: color,
  secondaryForeground: color,
  muted: color,
  mutedForeground: color,
  accent: color,
  accentForeground: color,
  destructive: color,
  destructiveForeground: color,
  success: color,
  successForeground: color,
  warning: color,
  warningForeground: color,
  border: color,
  input: color,
  ring: color,
});
const fullColors = colorsSchema;

const designSchema = z.strictObject({
  brand: z.strictObject({ name: z.string().max(200).optional(), logo: logo.optional() }).optional(),
  colors: z.strictObject({ light: fullColors, dark: fullColors.partial().optional() }),
  radius: length.optional(),
  fonts: z
    .strictObject({ body: font.optional(), heading: font.optional(), mono: font.optional() })
    .optional(),
  darkMode: z.enum(["media", "class", "off"]).optional(),
});

/** The light colors, overridden by the dark tokens the file defines. */
function withDefined(
  light: DesignColors,
  dark: Readonly<Record<string, string | undefined>> | undefined,
): DesignColors {
  const defined = Object.entries(dark ?? {}).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return { ...light, ...Object.fromEntries(defined) };
}

const SYSTEM_FONTS = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

type ParsedDesign = z.infer<typeof designSchema>;

function resolveFonts(fonts: ParsedDesign["fonts"]): ElearningDesign["fonts"] {
  const body = fonts?.body ?? SYSTEM_FONTS;
  return { body, heading: fonts?.heading ?? body, mono: fonts?.mono ?? "ui-monospace, monospace" };
}

function resolveBrand(brand: ParsedDesign["brand"]): ElearningDesign["brand"] {
  return { name: brand?.name ?? "", logo: brand?.logo ?? null };
}

/**
 * Validates a design file (spec 11) and resolves it: dark colors fall back to
 * the light ones token by token, and a design without dark colors stays light.
 * Throws with every invalid token named, so a wrong value fails at startup
 * instead of rendering wrong.
 */
export function defineDesign(input: DesignInput): ElearningDesign {
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
    throw new Error(`Invalid design: ${issues.join("; ")}`);
  }
  const { brand, colors, radius, fonts, darkMode } = parsed.data;
  return {
    brand: resolveBrand(brand),
    colors: { light: colors.light, dark: withDefined(colors.light, colors.dark) },
    radius: radius ?? "0.5rem",
    fonts: resolveFonts(fonts),
    darkMode: colors.dark === undefined ? "off" : (darkMode ?? "media"),
  };
}

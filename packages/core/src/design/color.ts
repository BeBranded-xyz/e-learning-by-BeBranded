/**
 * The color formats a design file accepts (spec 11): `#rgb`, `#rgba`,
 * `#rrggbb`, `#rrggbbaa`, `rgb()`, `hsl()` and `oklch()`. Anything else is
 * refused, so a design value can never carry other CSS. Parsed colors are
 * sRGB channels in [0, 1], for contrast checks and for exports that need hex.
 */

export type Rgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
};

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;
const PART = String.raw`(${NUMBER})(%|deg)?`;
const FUNCTION = new RegExp(
  String.raw`^(rgb|rgba|hsl|hsla|oklch)\(\s*${PART}[\s,]+${PART}[\s,]+${PART}(?:\s*[,/]\s*${PART})?\s*\)$`,
  "i",
);
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function parseHex(digits: string): Rgb {
  const full = digits.length <= 4 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  const channel = (index: number) => parseInt(full.slice(index * 2, index * 2 + 2), 16) / 255;
  return { r: channel(0), g: channel(1), b: channel(2), alpha: full.length === 8 ? channel(3) : 1 };
}

type Part = { readonly value: number; readonly unit: string | undefined };

/** A channel as a fraction: percentages over 100, plain numbers over `scale`. */
const fraction = (part: Part, scale: number) =>
  part.unit === "%" ? part.value / 100 : part.value / scale;

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const k = (n: number) => (n + hue / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n: number) => lightness - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** OKLCH to sRGB (Björn Ottosson's published OKLab matrices), gamma-encoded. */
function oklchToRgb(lightness: number, chroma: number, hue: number): [number, number, number] {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const encode = (value: number) =>
    value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  return [encode(linear[0] ?? 0), encode(linear[1] ?? 0), encode(linear[2] ?? 0)];
}

function channels(kind: string, parts: readonly [Part, Part, Part]): [number, number, number] {
  const [first, second, third] = parts;
  if (kind.startsWith("rgb"))
    return [fraction(first, 255), fraction(second, 255), fraction(third, 255)];
  if (kind.startsWith("hsl")) {
    return hslToRgb(((first.value % 360) + 360) % 360, fraction(second, 100), fraction(third, 100));
  }
  return oklchToRgb(
    fraction(first, 1),
    second.unit === "%" ? (second.value / 100) * 0.4 : second.value,
    third.value,
  );
}

/** The color, or null when the value is not one of the accepted formats. */
export function parseColor(value: string): Rgb | null {
  const trimmed = value.trim();
  const hex = HEX.exec(trimmed);
  if (hex?.[1] !== undefined) return parseHex(hex[1]);
  const match = FUNCTION.exec(trimmed);
  if (match === null) return null;
  const part = (index: number): Part => ({ value: Number(match[index]), unit: match[index + 1] });
  const [r, g, b] = channels((match[1] ?? "").toLowerCase(), [part(2), part(4), part(6)]);
  const alpha = match[8] === undefined ? 1 : fraction(part(8), 1);
  return { r: clamp(r), g: clamp(g), b: clamp(b), alpha: clamp(alpha) };
}

/** `#rrggbb`, ignoring alpha: what Word and the print CSS accept. */
export function toHex(color: Rgb): string {
  const byte = (channel: number) =>
    Math.round(clamp(channel) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(color.r)}${byte(color.g)}${byte(color.b)}`;
}

/** WCAG 2 relative luminance. */
function luminance(color: Rgb): number {
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** WCAG 2 contrast ratio, from 1 to 21. Alpha is ignored: tokens are opaque by convention. */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

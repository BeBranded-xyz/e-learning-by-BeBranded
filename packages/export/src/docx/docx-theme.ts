// The Word file's look, from the design file (spec 11): fonts and colors.
// Values are validated again here: only #rrggbb colors and plain font names.

export type DocxThemeInput = {
  readonly primaryColor?: string | undefined;
  readonly textColor?: string | undefined;
  readonly mutedColor?: string | undefined;
  readonly fontFamily?: string | undefined;
  readonly headingFontFamily?: string | undefined;
};

export type DocxTheme = {
  /** Colors as Word writes them: six hex digits, no "#". */
  readonly primary: string;
  readonly text: string;
  readonly muted: string;
  /** Word takes one font name: the first of the family list. */
  readonly font: string;
  readonly headingFont: string;
};

const HEX = /^#([0-9a-f]{6})$/i;
const FONT = /^[A-Za-z0-9 ,'"-]{1,200}$/;

const hex = (value: string | undefined, fallback: string) =>
  HEX.exec(value ?? "")?.[1]?.toUpperCase() ?? fallback;

/** The first family of a CSS font list, unquoted; generic families map to Word's defaults. */
function firstFont(value: string | undefined, fallback: string): string {
  if (value === undefined || !FONT.test(value)) return fallback;
  const first = (value.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  const generic = ["system-ui", "-apple-system", "sans-serif", "serif", "inherit", "ui-sans-serif"];
  return first === "" || generic.includes(first) ? fallback : first;
}

export function resolveDocxTheme(input: DocxThemeInput = {}): DocxTheme {
  const font = firstFont(input.fontFamily, "Calibri");
  return {
    primary: hex(input.primaryColor, "1D4ED8"),
    text: hex(input.textColor, "111827"),
    muted: hex(input.mutedColor, "4B5563"),
    font,
    headingFont: firstFont(input.headingFontFamily, font),
  };
}

const HEADING_SIZES = [32, 26, 24, 22, 22, 22] as const;

/** Document defaults, headings and the module's paragraph styles (quote, code). */
export function docxStyles(theme: DocxTheme) {
  const heading = (size: number) => ({
    run: { font: theme.headingFont, color: theme.text, size, bold: true },
  });
  return {
    default: {
      document: { run: { font: theme.font, color: theme.text, size: 22 } },
      title: { run: { font: theme.headingFont, color: theme.text, size: 48 } },
      heading1: heading(HEADING_SIZES[0]),
      heading2: heading(HEADING_SIZES[1]),
      heading3: heading(HEADING_SIZES[2]),
      heading4: heading(HEADING_SIZES[3]),
      heading5: heading(HEADING_SIZES[4]),
      heading6: heading(HEADING_SIZES[5]),
    },
    paragraphStyles: [
      {
        id: "Quote",
        name: "Quote",
        basedOn: "Normal",
        run: { italics: true, color: theme.muted },
        paragraph: { indent: { left: 567 } },
      },
      {
        id: "Code",
        name: "Code",
        basedOn: "Normal",
        run: { font: "Consolas", size: 18 },
        paragraph: { shading: { fill: "F3F4F6" }, spacing: { after: 0 } },
      },
    ],
  };
}

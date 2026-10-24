/** Print CSS of exported documents (CSS Paged Media); theme values are validated before use. */

export type ExportTheme = {
  readonly primaryColor?: string | undefined;
  readonly fontFamily?: string | undefined;
};

export type PageSize = "A4" | "Letter";

const HEX = /^#[0-9a-f]{6}$/i;
// Letters, digits, spaces, commas, quotes and hyphens only: nothing that can close the rule.
const FONT = /^[A-Za-z0-9 ,'"-]{1,200}$/;

function safeTheme(theme: ExportTheme = {}) {
  return {
    primary:
      theme.primaryColor !== undefined && HEX.test(theme.primaryColor)
        ? theme.primaryColor
        : "#4338ca",
    font:
      theme.fontFamily !== undefined && FONT.test(theme.fontFamily)
        ? theme.fontFamily
        : "system-ui, sans-serif",
  };
}

// One rule per 5% step: column widths are data attributes, never inline styles.
const COLUMN_RULES = Array.from({ length: 18 }, (_, index) => 15 + index * 5)
  .map((width) => `.el-column[data-width="${width}"] { flex-grow: ${width}; }`)
  .join("\n");

export function exportCss(theme: ExportTheme, pageSize: PageSize): string {
  const { primary, font } = safeTheme(theme);
  return `
@page { size: ${pageSize}; margin: 22mm 16mm 20mm; }
:root { --el-primary: ${primary}; }
body { margin: 0; font-family: ${font}; font-size: 11pt; line-height: 1.5; color: #111827; }
h1, h2, h3, h4, h5, h6 { break-after: avoid; color: #111827; }
h1 { font-size: 22pt; } h2 { font-size: 17pt; } h3 { font-size: 14pt; }
/* Lesson headings shift down in a course (to h6): every level stays above body size. */
h4 { font-size: 13pt; } h5 { font-size: 12pt; } h6 { font-size: 11.5pt; }
a { color: var(--el-primary); }
img { max-width: 100%; height: auto; }
figure { margin: 1em 0; break-inside: avoid; }
figcaption { color: #4b5563; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; }
thead { display: table-header-group; }
th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; vertical-align: top; }
tr { break-inside: avoid; }
pre { white-space: pre-wrap; background: #f3f4f6; padding: 8px; border-radius: 4px; font-size: 9pt; }
blockquote { margin: 1em 0; padding-left: 12px; border-left: 4px solid #d1d5db; color: #374151; }
.el-callout { margin: 1em 0; padding: 8px 12px; border-left: 4px solid var(--el-primary); background: #f7f7f9; break-inside: avoid; }
.el-callout[data-variant="success"] { border-color: #15803d; }
.el-callout[data-variant="warning"] { border-color: #b45309; }
.el-callout[data-variant="danger"] { border-color: #b91c1c; }
.el-group { margin-left: 1.5em; }
.el-columns { display: flex; gap: 12px; margin: 1em 0; break-inside: avoid; }
.el-column { flex: 1 1 0; min-width: 0; }
${COLUMN_RULES}
.el-list-check { list-style: none; padding-left: 0.5em; }
.el-cover { min-height: 60vh; display: flex; flex-direction: column; justify-content: center; break-after: page; }
.el-cover img { max-height: 48px; width: auto; align-self: flex-start; }
.el-meta { color: #4b5563; }
.el-toc { break-after: page; }
.el-section[data-depth="1"] { break-before: page; }
.el-section:first-of-type { break-before: auto; }
[data-text-alignment="center"] { text-align: center; }
[data-text-alignment="right"] { text-align: right; }
[data-text-alignment="justify"] { text-align: justify; }
`;
}

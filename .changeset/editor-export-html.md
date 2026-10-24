---
"@bebranded/elearning-editor": minor
---

`renderExportHtml` (from `@bebranded/elearning-editor/server`) renders an `ExportDocument` to a complete, self-contained HTML document for PDF export: print CSS (A4 or Letter), the host's primary color and font validated before use, a cover page, table of contents and shifted headings for courses, header rows repeated on every page, uploaded images only as inlined data URIs, and the body sanitized so the browser runs no script and fetches nothing.

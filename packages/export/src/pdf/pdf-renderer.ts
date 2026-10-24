import { escapeForTemplate } from "./templates.js";

export type PdfRequest = {
  /** Generated, sanitized HTML (renderExportHtml): never user HTML, never a URL. */
  readonly html: string;
  readonly pageSize: "A4" | "Letter";
  /** Printed in the page header. */
  readonly title: string;
  /** Printed in the footer before the page number, e.g. the export date. */
  readonly footer: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal | undefined;
};

/** Turns export HTML into a PDF with headless Chromium (spec 10, "PdfRenderer port"). */
export type PdfRenderer = {
  readonly name: string;
  render(request: PdfRequest): Promise<Uint8Array>;
  /** Releases a browser kept between renders; optional. */
  close?(): Promise<void>;
};

export const PDF_MARGINS = { top: "22mm", bottom: "20mm", left: "16mm", right: "16mm" } as const;

/** Chromium's header and footer templates; the page number classes are filled by the browser. */
export function headerFooter(request: Pick<PdfRequest, "title" | "footer">) {
  const style =
    "font-family: system-ui, sans-serif; font-size: 8px; color: #6b7280; width: 100%; padding: 0 16mm;";
  return {
    headerTemplate: `<div style="${style}">${escapeForTemplate(request.title)}</div>`,
    footerTemplate: `<div style="${style} text-align: center;">${escapeForTemplate(request.footer)} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  };
}

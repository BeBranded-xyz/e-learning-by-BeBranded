import { AppError } from "@bebranded/elearning-core";

import { headerFooter } from "./pdf-renderer.js";
import type { PdfRenderer, PdfRequest } from "./pdf-renderer.js";

export type GotenbergPdfOptions = {
  /** Base URL of the host's Gotenberg container, e.g. http://gotenberg:3000. */
  readonly url: string;
  readonly fetch?: typeof fetch;
};

/** Paper sizes and margins in inches, as Gotenberg's Chromium route takes them. */
const PAPER = {
  A4: { width: "8.27", height: "11.69" },
  Letter: { width: "8.5", height: "11" },
} as const;
const MARGINS = {
  marginTop: "0.87",
  marginBottom: "0.79",
  marginLeft: "0.63",
  marginRight: "0.63",
} as const;

function form(request: PdfRequest): FormData {
  const body = new FormData();
  const { headerTemplate, footerTemplate } = headerFooter(request);
  const page = (html: string) =>
    `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  body.append("files", new Blob([request.html], { type: "text/html" }), "index.html");
  body.append("files", new Blob([page(headerTemplate)], { type: "text/html" }), "header.html");
  body.append("files", new Blob([page(footerTemplate)], { type: "text/html" }), "footer.html");
  body.append("paperWidth", PAPER[request.pageSize].width);
  body.append("paperHeight", PAPER[request.pageSize].height);
  for (const [key, value] of Object.entries(MARGINS)) body.append(key, value);
  body.append("printBackground", "true");
  body.append("preferCssPageSize", "true");
  return body;
}

/**
 * PDF through a Gotenberg container (HTML route). Run Gotenberg with its
 * Chromium deny list blocking every URL: export HTML needs no network.
 */
export function gotenbergPdf(options: GotenbergPdfOptions): PdfRenderer {
  let base = options.url;
  while (base.endsWith("/")) base = base.slice(0, -1);
  const endpoint = `${base}/forms/chromium/convert/html`;
  return {
    name: "gotenberg",
    render: async (request) => {
      const timeout = AbortSignal.timeout(request.timeoutMs);
      const signal =
        request.signal === undefined ? timeout : AbortSignal.any([timeout, request.signal]);
      const response = await (options.fetch ?? fetch)(endpoint, {
        method: "POST",
        body: form(request),
        signal,
      });
      if (!response.ok) {
        throw new AppError(
          "upstream",
          "pdf_renderer_error",
          `Gotenberg answered ${response.status}.`,
        );
      }
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

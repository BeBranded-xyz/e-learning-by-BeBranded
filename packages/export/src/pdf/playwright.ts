import { PDF_MARGINS, headerFooter } from "./pdf-renderer.js";
import type { PdfRenderer, PdfRequest } from "./pdf-renderer.js";

// The parts of Playwright's API the adapter uses, so the package does not
// depend on Playwright: the host passes its own `chromium` (playwright-core).

type Route = { abort(): Promise<void> };
type Page = {
  setContent(html: string, options: { waitUntil: "load"; timeout: number }): Promise<void>;
  pdf(options: Record<string, unknown>): Promise<Uint8Array>;
};
type Context = {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<unknown>;
  newPage(): Promise<Page>;
  close(): Promise<void>;
};
export type PlaywrightBrowser = {
  newContext(options: { javaScriptEnabled: boolean; offline: boolean }): Promise<Context>;
  close(): Promise<void>;
};

export type PlaywrightPdfOptions = {
  /** Starts Chromium, e.g. `() => chromium.launch()` from playwright-core. Called once, then reused. */
  readonly launch: () => Promise<PlaywrightBrowser>;
};

async function renderIn(browser: PlaywrightBrowser, request: PdfRequest): Promise<Uint8Array> {
  // No script, no network: every request the page would make is refused.
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
  try {
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(request.html, { waitUntil: "load", timeout: request.timeoutMs });
    const pdf = await page.pdf({
      format: request.pageSize,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margin: PDF_MARGINS,
      ...headerFooter(request),
    });
    // Drivers answer a Node Buffer; the port promises a plain Uint8Array.
    return new Uint8Array(pdf);
  } finally {
    await context.close();
  }
}

/** PDF with Playwright's Chromium (Node and self-hosted servers). */
export function playwrightPdf(options: PlaywrightPdfOptions): PdfRenderer {
  let browser: Promise<PlaywrightBrowser> | null = null;
  return {
    name: "playwright",
    render: (request) => {
      browser ??= options.launch();
      return browser.then((instance) => renderIn(instance, request));
    },
    close: async () => {
      const current = browser;
      browser = null;
      if (current !== null) await (await current).close();
    },
  };
}

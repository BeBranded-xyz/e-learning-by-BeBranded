import { PDF_MARGINS, headerFooter } from "./pdf-renderer.js";
import type { PdfRenderer, PdfRequest } from "./pdf-renderer.js";

// The parts of Puppeteer's API the adapter uses. puppeteer-core with
// @sparticuz/chromium (serverless) and @cloudflare/puppeteer (Browser
// Rendering) share it, so one adapter serves both.

type Request = { url(): string; abort(): Promise<void>; continue(): Promise<void> };
type Page = {
  setJavaScriptEnabled(enabled: boolean): Promise<void>;
  setRequestInterception(enabled: boolean): Promise<void>;
  on(event: "request", handler: (request: Request) => void): unknown;
  setContent(html: string, options: { waitUntil: "load"; timeout: number }): Promise<void>;
  pdf(options: Record<string, unknown>): Promise<Uint8Array>;
  close(): Promise<void>;
};
export type PuppeteerBrowser = { newPage(): Promise<Page>; close(): Promise<void> };

export type PuppeteerPdfOptions = {
  /**
   * Opens a browser, e.g. `() => puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args })`
   * or `() => puppeteer.launch(env.BROWSER)` on Cloudflare. Called for every
   * render unless `reuse` is true.
   */
  readonly launch: () => Promise<PuppeteerBrowser>;
  readonly reuse?: boolean;
};

/** Inlined pictures are the only resources a page may load; they never leave the process. */
const allowed = (url: string) => url.startsWith("data:");

async function renderIn(browser: PuppeteerBrowser, request: PdfRequest): Promise<Uint8Array> {
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (pending) => {
      void (allowed(pending.url()) ? pending.continue() : pending.abort());
    });
    await page.setContent(request.html, { waitUntil: "load", timeout: request.timeoutMs });
    const pdf = await page.pdf({
      format: request.pageSize,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margin: PDF_MARGINS,
      timeout: request.timeoutMs,
      ...headerFooter(request),
    });
    // Drivers answer a Node Buffer; the port promises a plain Uint8Array.
    return new Uint8Array(pdf);
  } finally {
    await page.close();
  }
}

/** PDF with any Puppeteer-compatible browser (serverless Chromium, Cloudflare Browser Rendering). */
export function puppeteerPdf(options: PuppeteerPdfOptions): PdfRenderer {
  let shared: Promise<PuppeteerBrowser> | null = null;
  return {
    name: "puppeteer",
    render: async (request) => {
      if (options.reuse === true) {
        shared ??= options.launch();
        return renderIn(await shared, request);
      }
      const browser = await options.launch();
      try {
        return await renderIn(browser, request);
      } finally {
        await browser.close();
      }
    },
    close: async () => {
      const current = shared;
      shared = null;
      if (current !== null) await (await current).close();
    },
  };
}

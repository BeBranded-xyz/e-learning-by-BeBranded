import { describe, expect, it } from "vitest";

import { puppeteerPdf } from "./puppeteer.js";
import type { PuppeteerBrowser } from "./puppeteer.js";

type Pending = { url: string; outcome: "continue" | "abort" | null };

/** A fake Puppeteer browser that records what the adapter asks of it. */
function fakeBrowser(requests: readonly string[] = []) {
  const log: string[] = [];
  const handled: Pending[] = [];
  const browser: PuppeteerBrowser = {
    newPage: () =>
      Promise.resolve({
        setJavaScriptEnabled: (enabled: boolean) => {
          log.push(`javascript:${String(enabled)}`);
          return Promise.resolve();
        },
        setRequestInterception: (enabled: boolean) => {
          log.push(`interception:${String(enabled)}`);
          return Promise.resolve();
        },
        on: (
          _event: "request",
          handler: (request: {
            url(): string;
            abort(): Promise<void>;
            continue(): Promise<void>;
          }) => void,
        ) => {
          for (const url of requests) {
            const entry: Pending = { url, outcome: null };
            handled.push(entry);
            handler({
              url: () => url,
              abort: () => {
                entry.outcome = "abort";
                return Promise.resolve();
              },
              continue: () => {
                entry.outcome = "continue";
                return Promise.resolve();
              },
            });
          }
          return undefined;
        },
        setContent: (_html: string, options: { waitUntil: "load"; timeout: number }) => {
          log.push(`content:${options.waitUntil}:${String(options.timeout)}`);
          return Promise.resolve();
        },
        pdf: (options: Record<string, unknown>) => {
          log.push(`pdf:${String(options.format)}:${String(options.displayHeaderFooter)}`);
          return Promise.resolve(Buffer.from("%PDF-"));
        },
        close: () => {
          log.push("page closed");
          return Promise.resolve();
        },
      }),
    close: () => {
      log.push("browser closed");
      return Promise.resolve();
    },
  };
  return { browser, log, handled };
}

const request = {
  html: "<p>x</p>",
  pageSize: "Letter" as const,
  title: "T",
  footer: "F",
  timeoutMs: 5000,
};

describe("puppeteerPdf", () => {
  it("disables JavaScript and intercepts requests before loading the page, then closes it", async () => {
    const fake = fakeBrowser();
    const pdf = await puppeteerPdf({ launch: () => Promise.resolve(fake.browser) }).render(request);

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(Buffer.isBuffer(pdf)).toBe(false);
    expect(fake.log).toEqual([
      "javascript:false",
      "interception:true",
      "content:load:5000",
      "pdf:Letter:true",
      "page closed",
      "browser closed",
    ]);
  });

  it("aborts every request except inlined data pictures", async () => {
    const fake = fakeBrowser([
      "http://127.0.0.1/a.png",
      "https://example.com/x.css",
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
    ]);

    await puppeteerPdf({ launch: () => Promise.resolve(fake.browser) }).render(request);

    expect(fake.handled.map((entry) => entry.outcome)).toEqual([
      "abort",
      "abort",
      "abort",
      "continue",
    ]);
  });

  it("launches once and keeps the browser with reuse, until closed", async () => {
    const fake = fakeBrowser();
    let launches = 0;
    const renderer = puppeteerPdf({
      launch: () => {
        launches += 1;
        return Promise.resolve(fake.browser);
      },
      reuse: true,
    });

    await renderer.render(request);
    await renderer.render(request);
    await renderer.close?.();

    expect(launches).toBe(1);
    expect(fake.log.filter((entry) => entry === "browser closed")).toHaveLength(1);
  });

  it("launches a browser per render without reuse, and closing is then a no-op", async () => {
    const fake = fakeBrowser();
    let launches = 0;
    const renderer = puppeteerPdf({
      launch: () => {
        launches += 1;
        return Promise.resolve(fake.browser);
      },
    });

    await renderer.render(request);
    await renderer.render(request);
    await renderer.close?.();

    expect(launches).toBe(2);
    expect(fake.log.filter((entry) => entry === "browser closed")).toHaveLength(2);
  });
});

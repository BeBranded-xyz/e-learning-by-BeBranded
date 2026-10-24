import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "playwright-core";
import puppeteer from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { elearningExport, playwrightPdf, puppeteerPdf } from "../../src/index.js";
import type { PdfRenderer } from "../../src/index.js";
import { IMAGE_ID, courseExport, lessonExport } from "../fixtures/documents.js";
import { PNG_1X1 } from "../fixtures/images.js";

// Real headless Chromium (Playwright's build), through both adapters.

async function pdfText(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const content = await (await pdf.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return { pages: pdf.numPages, text: pages.join("\n").replace(/\s+/g, " ") };
}

/** A local server that counts every request: a sandboxed page must not reach it. */
let hits = 0;
let origin = "";
const server = createServer((_request, response) => {
  hits += 1;
  response.end("x");
});

const renderers: Record<string, PdfRenderer> = {
  playwright: playwrightPdf({ launch: () => chromium.launch() }),
  puppeteer: puppeteerPdf({
    launch: () => puppeteer.launch({ executablePath: chromium.executablePath(), headless: true }),
    reuse: true,
  }),
};

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await Promise.all(
    Object.values(renderers).map((renderer) => renderer.close?.() ?? Promise.resolve()),
  );
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
});

const raw = (body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
const request = (html: string) => ({
  html,
  pageSize: "A4" as const,
  title: "Sandbox",
  footer: "Footer",
  timeoutMs: 20_000,
});

describe.each(Object.entries(renderers))("PDF through %s", (_name, renderer) => {
  const exporter = elearningExport({ pdf: renderer });
  const loadImage = (id: string) => Promise.resolve(id === IMAGE_ID ? PNG_1X1 : null);

  it("renders a lesson with its text, list, table and caption", async () => {
    const file = await exporter.export(lessonExport(), { format: "pdf", loadImage });

    expect(file.contentType).toBe("application/pdf");
    expect(new TextDecoder().decode(file.bytes.slice(0, 5))).toBe("%PDF-");
    const { text } = await pdfText(file.bytes);
    for (const expected of [
      "Fire safety",
      "Workplace safety",
      "Before you start",
      "Exit route",
      "Raise the alarm",
      "Exit A",
      "Floor map",
      "Never use lifts",
    ]) {
      expect(text).toContain(expected);
    }
    expect(text).toContain("Exported on October 24, 2026");
  });

  it("renders a course over several pages with its contents and French words", async () => {
    const { text, pages } = await pdfText(
      (await exporter.export(courseExport(), { format: "pdf", loadImage })).bytes,
    );

    expect(pages).toBeGreaterThanOrEqual(3);
    expect(text).toContain("Sommaire");
    expect(text).toContain("Evacuation video");
  });

  it("runs no script", async () => {
    const html = raw(
      '<p id="t">static</p><script>document.getElementById("t").textContent = "scripted"</script>',
    );

    const { text } = await pdfText(await renderer.render(request(html)));

    expect(text).toContain("static");
    expect(text).not.toContain("scripted");
  });

  it("loads nothing from the network, whatever the HTML asks for", async () => {
    const before = hits;
    const html = raw(
      `<link rel="stylesheet" href="${origin}/style.css"><img src="${origin}/a.png"><iframe src="${origin}/frame"></iframe>` +
        `<p style="background: url(${origin}/bg.png)">x</p><object data="${origin}/o"></object>`,
    );

    await renderer.render(request(html));

    expect(hits - before).toBe(0);
  });
});

describe("browser lifecycle", () => {
  it("opens and closes a browser per render without reuse, and closing unused renderers is a no-op", async () => {
    let launches = 0;
    const renderer = puppeteerPdf({
      launch: () => {
        launches += 1;
        return puppeteer.launch({ executablePath: chromium.executablePath(), headless: true });
      },
    });

    await renderer.render(request(raw("<p>one</p>")));
    await renderer.render(request(raw("<p>two</p>")));

    expect(launches).toBe(2);
    await expect(renderer.close?.()).resolves.toBeUndefined();
    await expect(
      playwrightPdf({ launch: () => chromium.launch() }).close?.(),
    ).resolves.toBeUndefined();
  });
});

describe("export timeout", () => {
  it("answers export_timeout when the renderer is too slow", async () => {
    const stuck: PdfRenderer = { name: "stuck", render: () => new Promise(() => undefined) };

    const attempt = elearningExport({ pdf: stuck, timeoutMs: 50 }).export(lessonExport(), {
      format: "pdf",
      loadImage: () => Promise.resolve(null),
    });

    await expect(attempt).rejects.toMatchObject({ kind: "upstream", code: "export_timeout" });
  });
});

import { describe, expect, it } from "vitest";

import { formatExportDate, labelsFor } from "./labels.js";
import { Limiter } from "./limiter.js";
import { gotenbergPdf } from "./pdf/gotenberg.js";
import { headerFooter } from "./pdf/pdf-renderer.js";

describe("labels", () => {
  it("speaks English by default and French for fr", () => {
    expect(labelsFor("en-GB").tableOfContents).toBe("Contents");
    expect(labelsFor("fr").exportedOn("24 octobre 2026")).toBe("Exporté le 24 octobre 2026");
    expect(labelsFor("de").video).toBe("Video");
  });

  it("formats the export date in UTC, and falls back to English for a malformed locale", () => {
    expect(formatExportDate("2026-10-24T23:30:00Z", "fr")).toBe("24 octobre 2026");
    expect(formatExportDate("2026-10-24T23:30:00Z", "x<y")).toBe("October 24, 2026");
  });
});

describe("Limiter", () => {
  it("runs up to the limit at once, queues a few, refuses the rest", async () => {
    const limiter = new Limiter(1, 1);
    let release: () => void = () => undefined;
    const first = limiter.run(
      () =>
        new Promise<string>((resolve) => {
          release = () => {
            resolve("first");
          };
        }),
    );
    const second = limiter.run(() => Promise.resolve("second"));

    await expect(limiter.run(() => Promise.resolve("third"))).rejects.toMatchObject({
      code: "export_busy",
      kind: "rate_limit",
    });
    release();
    expect(await Promise.all([first, second])).toEqual(["first", "second"]);
    expect(await limiter.run(() => Promise.resolve("again"))).toBe("again");
  });

  it("frees its slot when the work fails", async () => {
    const limiter = new Limiter(1, 0);

    await expect(limiter.run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await limiter.run(() => Promise.resolve("next"))).toBe("next");
  });
});

describe("headerFooter", () => {
  it("escapes the title and footer for Chromium's templates", () => {
    const { headerTemplate, footerTemplate } = headerFooter({ title: "<b>A</b>", footer: '"x"' });

    expect(headerTemplate).toContain("&lt;b&gt;A&lt;/b&gt;");
    expect(footerTemplate).toContain("&quot;x&quot;");
    expect(footerTemplate).toContain('<span class="pageNumber"></span>');
  });
});

describe("gotenbergPdf", () => {
  const request = {
    html: "<p>Hi</p>",
    pageSize: "Letter" as const,
    title: "T",
    footer: "F",
    timeoutMs: 1000,
  };

  it("posts the HTML, header, footer and paper to the Chromium route", async () => {
    const calls: { url: string; body: FormData }[] = [];
    const renderer = gotenbergPdf({
      url: "http://gotenberg.example.com:3000///",
      fetch: (url, init) => {
        calls.push({ url: new Request(url).url, body: init?.body as FormData });
        return Promise.resolve(new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46])));
      },
    });

    const pdf = await renderer.render(request);

    expect([...pdf]).toEqual([0x25, 0x50, 0x44, 0x46]);
    expect(calls[0]?.url).toBe("http://gotenberg.example.com:3000/forms/chromium/convert/html");
    const body = calls[0]?.body;
    expect(body?.getAll("files").map((file) => (file as File).name)).toEqual([
      "index.html",
      "header.html",
      "footer.html",
    ]);
    expect(await (body?.getAll("files")[0] as File).text()).toBe("<p>Hi</p>");
    expect([
      body?.get("paperWidth"),
      body?.get("paperHeight"),
      body?.get("printBackground"),
    ]).toEqual(["8.5", "11", "true"]);
  });

  it("passes the caller's signal along with the deadline", async () => {
    const controller = new AbortController();
    let received: AbortSignal | null | undefined;
    const renderer = gotenbergPdf({
      url: "http://g.example.com",
      fetch: (_url, init) => {
        received = init?.signal;
        return Promise.resolve(new Response(new Uint8Array([1])));
      },
    });

    await renderer.render({ ...request, signal: controller.signal });
    controller.abort();

    expect(received?.aborted).toBe(true);
  });

  it("fails as an upstream error when Gotenberg refuses", async () => {
    const renderer = gotenbergPdf({
      url: "http://g.example.com",
      fetch: () => Promise.resolve(new Response("no", { status: 503 })),
    });

    await expect(renderer.render(request)).rejects.toMatchObject({
      kind: "upstream",
      code: "pdf_renderer_error",
    });
  });
});

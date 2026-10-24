import { afterEach, describe, expect, it, vi } from "vitest";

import { lessonExport } from "../tests/fixtures/documents.js";
import { elearningExport } from "./elearning-export.js";
import type { PdfRequest } from "./pdf/pdf-renderer.js";

afterEach(() => vi.useRealTimers());

describe("export cancellation", () => {
  it("keeps a timed-out render's slot until the renderer actually stops", async () => {
    vi.useFakeTimers();
    let finish: (bytes: Uint8Array) => void = () => undefined;
    const render = vi.fn<(request: PdfRequest) => Promise<Uint8Array>>(
      () =>
        new Promise<Uint8Array>((resolve) => {
          finish = resolve;
        }),
    );
    const exporter = elearningExport({
      pdf: { name: "controlled", render },
      timeoutMs: 100,
      maxConcurrent: 1,
      maxQueued: 0,
    });
    const request = { format: "pdf" as const, loadImage: () => Promise.resolve(null) };
    const first = exporter.export(lessonExport(), request);
    const expired = expect(first).rejects.toMatchObject({ code: "export_timeout" });
    await vi.advanceTimersByTimeAsync(100);
    await expired;

    await expect(exporter.export(lessonExport(), request)).rejects.toMatchObject({
      code: "export_busy",
    });
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0]?.[0].signal?.aborted).toBe(true);
    finish(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(0);
  });

  it("refuses an already-aborted export without starting the renderer", async () => {
    const render = vi.fn(() => Promise.resolve(new Uint8Array([1])));
    const exporter = elearningExport({ pdf: { name: "controlled", render } });
    const controller = new AbortController();
    controller.abort();

    await expect(
      exporter.export(lessonExport(), {
        format: "pdf",
        loadImage: () => Promise.resolve(null),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(render).not.toHaveBeenCalled();
  });
  it("propagates caller cancellation into image loading and never starts PDF rendering", async () => {
    const controller = new AbortController();
    let imageSignal: AbortSignal | undefined;
    let finishImage: (bytes: null) => void = () => undefined;
    const loadImage = vi.fn((_id: unknown, signal?: AbortSignal) => {
      imageSignal = signal;
      return new Promise<null>((resolve) => {
        finishImage = resolve;
      });
    });
    const render = vi.fn(() => Promise.resolve(new Uint8Array([1])));
    const exporter = elearningExport({
      pdf: { name: "controlled", render },
      maxConcurrent: 1,
      maxQueued: 0,
    });
    const result = exporter.export(lessonExport(), {
      format: "pdf",
      loadImage,
      signal: controller.signal,
    });
    expect(loadImage).toHaveBeenCalledOnce();
    controller.abort(new Error("caller cancelled"));
    await expect(result).rejects.toThrow("caller cancelled");
    expect(imageSignal?.aborted).toBe(true);
    await expect(
      exporter.export(lessonExport(), { format: "pdf", loadImage }),
    ).rejects.toMatchObject({ code: "export_busy" });
    finishImage(null);
    await Promise.resolve();
    expect(render).not.toHaveBeenCalled();
  });
});

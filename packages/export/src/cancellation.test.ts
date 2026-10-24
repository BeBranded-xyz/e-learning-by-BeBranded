import { describe, expect, it, vi } from "vitest";

import { withAbortCleanup } from "./cancellation.js";

describe("browser abort cleanup", () => {
  it("closes a stuck resource on abort before rejecting", async () => {
    const controller = new AbortController();
    const close = vi.fn(() => Promise.resolve());
    const result = withAbortCleanup(controller.signal, close, () => new Promise(() => undefined));
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes a resource acquired after cancellation without starting work", async () => {
    const controller = new AbortController();
    controller.abort();
    const close = vi.fn(() => Promise.resolve());
    const work = vi.fn(() => Promise.resolve(1));
    await expect(withAbortCleanup(controller.signal, close, work)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(work).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("awaits cleanup after successful work without a signal", async () => {
    const close = vi.fn(() => Promise.resolve());
    await expect(withAbortCleanup(undefined, close, () => Promise.resolve(1))).resolves.toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("reports cleanup failures", async () => {
    const close = () => Promise.reject(new Error("close failed"));
    await expect(withAbortCleanup(undefined, close, () => Promise.resolve(1))).rejects.toThrow(
      "close failed",
    );
  });
});

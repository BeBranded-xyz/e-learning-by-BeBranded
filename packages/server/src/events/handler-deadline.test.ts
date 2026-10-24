import { afterEach, describe, expect, it, vi } from "vitest";

import { withHandlerDeadline } from "./handler-deadline.js";

afterEach(() => vi.useRealTimers());

describe("handler deadline", () => {
  it("aborts a stuck handler and rejects after the deadline", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const work = withHandlerDeadline((received) => {
      signal = received;
      return new Promise(() => undefined);
    });
    const result = expect(work).rejects.toThrow("delivery deadline");
    await vi.advanceTimersByTimeAsync(30_000);
    await result;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its deadline after success", async () => {
    vi.useFakeTimers();
    await expect(withHandlerDeadline(() => Promise.resolve())).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves the handler failure and clears its deadline", async () => {
    vi.useFakeTimers();
    await expect(
      withHandlerDeadline(() => Promise.reject(new Error("host failed"))),
    ).rejects.toThrow("host failed");
    expect(vi.getTimerCount()).toBe(0);
  });
});

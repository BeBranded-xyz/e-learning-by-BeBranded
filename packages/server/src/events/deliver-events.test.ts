import { describe, expect, it } from "vitest";

import { nextAttemptDelay } from "./deliver-events.js";

describe("nextAttemptDelay", () => {
  it.each([
    [1, 15_000, 30_000],
    [2, 30_000, 60_000],
    [3, 60_000, 120_000],
  ])("after attempt %i waits between %i and %i ms", (attempts, min, max) => {
    expect(nextAttemptDelay(attempts, () => 0)).toBe(min);
    expect(nextAttemptDelay(attempts, () => 1)).toBe(max);
  });

  it("caps the delay at 6 hours", () => {
    expect(nextAttemptDelay(50, () => 1)).toBe(6 * 60 * 60 * 1000);
  });

  it("treats a zero attempt count like the first attempt", () => {
    expect(nextAttemptDelay(0, () => 1)).toBe(30_000);
  });
});

import { describe, expect, it } from "vitest";

import { formatSeconds } from "./useCountdown.js";

describe("formatSeconds", () => {
  it("shows minutes and zero-padded seconds", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(9)).toBe("0:09");
    expect(formatSeconds(245)).toBe("4:05");
    expect(formatSeconds(3600)).toBe("60:00");
  });
});

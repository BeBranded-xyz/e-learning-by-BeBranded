import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { MAX_JSON_NESTING, measureJson } from "./json-size.js";

describe("measureJson", () => {
  it("is at least the real JSON length for any JSON value", () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 10 }), (value) => {
        const check = measureJson(value, Number.MAX_SAFE_INTEGER);

        expect(check.kind).toBe("ok");
        if (check.kind === "ok") {
          expect(check.bytes).toBeGreaterThanOrEqual(
            new TextEncoder().encode(JSON.stringify(value)).length - 2,
          );
        }
      }),
    );
  });

  it.each([
    ["control characters", "\u0000\u0001\u001f".repeat(20)],
    ["quotes and backslashes", '"\\'.repeat(20)],
    ["a line separator", "\u2028"],
    ["a lone surrogate", "\ud800"],
  ])("counts the escapes JSON writes for %s", (_name, value) => {
    const check = measureJson(value, Number.MAX_SAFE_INTEGER);

    expect(check).toEqual({
      kind: "ok",
      bytes: new TextEncoder().encode(JSON.stringify(value)).length,
    });
  });

  it("refuses a string whose escaped form is over the limit", () => {
    expect(measureJson("\u0000".repeat(20), 100)).toEqual({ kind: "too_large" });
  });

  it("counts UTF-8 bytes, not characters", () => {
    expect(measureJson("é", 100)).toEqual({ kind: "ok", bytes: 4 });
  });

  it("stops at the byte limit", () => {
    expect(measureJson(["a".repeat(50), "b".repeat(50)], 60)).toEqual({ kind: "too_large" });
  });

  it("accepts the maximum nesting and rejects one level more", () => {
    const nest = (depth: number) => {
      let value: unknown = 1;
      for (let level = 0; level < depth; level += 1) value = [value];
      return value;
    };

    expect(measureJson(nest(MAX_JSON_NESTING), 10_000).kind).toBe("ok");
    expect(measureJson(nest(MAX_JSON_NESTING + 1), 10_000).kind).toBe("too_deep");
  });

  it("treats values JSON cannot represent as null", () => {
    expect(measureJson(undefined, 100)).toEqual({ kind: "ok", bytes: 4 });
  });
});

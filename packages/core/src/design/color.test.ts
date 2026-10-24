import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { contrastRatio, parseColor, toHex } from "./color.js";

const rgb = (value: string) => {
  const color = parseColor(value);
  return color === null ? null : toHex(color);
};

describe("parseColor", () => {
  it.each([
    ["#fff", "#ffffff"],
    ["#0a0a0a", "#0a0a0a"],
    ["#ff000080", "#ff0000"],
    ["#f008", "#ff0000"],
    ["rgb(255, 0, 0)", "#ff0000"],
    ["rgb(0 128 255 / 50%)", "#0080ff"],
    ["rgba(100%, 0%, 0%, 0.5)", "#ff0000"],
    ["hsl(120 100% 25%)", "#008000"],
    ["hsla(0, 0%, 100%, 1)", "#ffffff"],
    ["oklch(1 0 0)", "#ffffff"],
    ["oklch(0 0 0)", "#000000"],
    ["oklch(62.8% 0.2577 29.23)", "#ff0000"],
    ["  #ABCDEF  ", "#abcdef"],
  ])("reads %s", (value, hex) => {
    expect(rgb(value)).toBe(hex);
  });

  it("keeps the alpha channel", () => {
    expect(parseColor("rgb(0 0 0 / 25%)")?.alpha).toBe(0.25);
    expect(parseColor("#00000080")?.alpha).toBeCloseTo(0.502, 3);
  });

  it.each([
    ["a color name", "red"],
    ["a CSS injection", "red; background: url(https://example.com/x)"],
    ["a closing brace", "#fff } body { display: none"],
    ["a variable", "var(--x)"],
    ["a gradient", "linear-gradient(red, blue)"],
    ["a bad hex", "#ggg"],
    ["five hex digits", "#12345"],
    ["an unknown function", "lab(50 20 30)"],
    ["nothing", ""],
  ])("refuses %s", (_label, value) => {
    expect(parseColor(value)).toBeNull();
  });

  it("round-trips every #rrggbb", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffff }), (value) => {
        const hex = `#${value.toString(16).padStart(6, "0")}`;
        expect(rgb(hex)).toBe(hex);
      }),
    );
  });
});

describe("contrastRatio", () => {
  const color = (value: string) => {
    const parsed = parseColor(value);
    if (parsed === null) throw new Error(value);
    return parsed;
  };

  it("matches WCAG's reference values", () => {
    expect(contrastRatio(color("#000"), color("#fff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(color("#777"), color("#fff"))).toBeCloseTo(4.48, 2);
    expect(contrastRatio(color("#fff"), color("#fff"))).toBe(1);
  });

  it("is symmetric and between 1 and 21", () => {
    const channel = fc.integer({ min: 0, max: 255 });
    fc.assert(
      fc.property(channel, channel, channel, channel, (a, b, c, d) => {
        const first = color(`rgb(${a} ${b} ${c})`);
        const second = color(`rgb(${d} ${d} ${d})`);
        const ratio = contrastRatio(first, second);

        expect(ratio).toBeCloseTo(contrastRatio(second, first), 10);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21);
      }),
    );
  });
});

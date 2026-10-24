import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { COLUMN_LIMITS, normalizeWidths, resizeColumns, widthStep } from "./column-widths.js";

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

describe("normalizeWidths", () => {
  it("turns widths into shares of the row", () => {
    expect(normalizeWidths([3, 1])).toEqual([0.75, 0.25]);
  });

  it("splits evenly when nothing has a width", () => {
    expect(normalizeWidths([0, 0, 0, 0])).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});

describe("resizeColumns", () => {
  it("moves width from the next column in 5% steps", () => {
    expect(resizeColumns([1, 1], 0, 0.05)).toEqual([0.55, 0.45]);
    expect(resizeColumns([1, 1], 0, -0.12)).toEqual([0.4, 0.6]);
  });

  it("only touches the column and its right neighbour", () => {
    expect(resizeColumns([1, 1, 2], 1, 0.05)).toEqual([0.25, 0.3, 0.45]);
  });

  it("never takes a column below 15% of the row", () => {
    expect(resizeColumns([1, 1], 0, 0.9)).toEqual([0.85, 0.15]);
    expect(resizeColumns([1, 1], 0, -0.9)).toEqual([0.15, 0.85]);
  });

  it("leaves widths that cannot both keep the minimum share as they are", () => {
    expect(resizeColumns([0.1, 0.1, 0.8], 0, 0.05)).toEqual([0.1, 0.1, 0.8]);
  });

  it("leaves the widths as they are for the last column or an unknown one", () => {
    expect(resizeColumns([1, 1], 1, 0.05)).toEqual([0.5, 0.5]);
    expect(resizeColumns([1, 1], -1, 0.05)).toEqual([0.5, 0.5]);
  });

  it("keeps every share above the minimum and the total at 1, whatever the move", () => {
    const widths = fc.array(fc.integer({ min: 15, max: 100 }), { minLength: 2, maxLength: 4 });
    fc.assert(
      fc.property(
        widths,
        fc.nat(3),
        fc.double({ min: -1, max: 1, noNaN: true }),
        (raw, at, delta) => {
          const shares = normalizeWidths(raw);
          fc.pre(shares.every((share) => share >= COLUMN_LIMITS.minShare));
          const next = resizeColumns(raw, at % (raw.length - 1), delta);

          expect(sum(next)).toBeCloseTo(1, 3);
          expect(next.every((share) => share >= COLUMN_LIMITS.minShare - 1e-3)).toBe(true);
        },
      ),
    );
  });
});

describe("widthStep", () => {
  it.each([
    [0.5, 50],
    [0.333, 35],
    [0.24, 25],
    [0.1, 15],
    [1.2, 100],
  ])("puts the share %d in the %d%% step", (share, step) => {
    expect(widthStep(share)).toBe(step);
  });
});

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { clampRanges, computeCoverage, mergeRanges, rangesLength } from "./ranges.js";
import type { WatchedRange } from "./video.schemas.js";

const rangeArb: fc.Arbitrary<WatchedRange> = fc
  .tuple(fc.integer({ min: 0, max: 600 }), fc.integer({ min: 0, max: 120 }))
  .map(([start, length]) => [start, start + length]);
const rangesArb = fc.array(rangeArb, { maxLength: 12 });

describe("mergeRanges", () => {
  it.each<[string, WatchedRange[], WatchedRange[]]>([
    ["no range", [], []],
    ["one range", [[1, 2]], [[1, 2]]],
    [
      "disjoint ranges, sorted",
      [
        [5, 6],
        [1, 2],
      ],
      [
        [1, 2],
        [5, 6],
      ],
    ],
    [
      "overlapping ranges",
      [
        [1, 4],
        [3, 6],
      ],
      [[1, 6]],
    ],
    [
      "touching ranges",
      [
        [1, 3],
        [3, 5],
      ],
      [[1, 5]],
    ],
    [
      "a range inside another",
      [
        [0, 10],
        [2, 3],
      ],
      [[0, 10]],
    ],
    [
      "empty and reversed ranges dropped",
      [
        [4, 4],
        [6, 5],
        [1, 2],
      ],
      [[1, 2]],
    ],
  ])("%s", (_name, input, expected) => {
    expect(mergeRanges(input)).toEqual(expected);
  });

  it("merges several lists", () => {
    expect(mergeRanges([[0, 2]], [[1, 3]], [[10, 11]])).toEqual([
      [0, 3],
      [10, 11],
    ]);
  });

  it("does not mutate its input", () => {
    const input: WatchedRange[] = [
      [3, 4],
      [1, 2],
    ];

    mergeRanges(input);

    expect(input).toEqual([
      [3, 4],
      [1, 2],
    ]);
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(rangesArb, (ranges) => {
        expect(mergeRanges(mergeRanges(ranges))).toEqual(mergeRanges(ranges));
      }),
    );
  });

  it("is commutative", () => {
    fc.assert(
      fc.property(rangesArb, rangesArb, (a, b) => {
        expect(mergeRanges(a, b)).toEqual(mergeRanges(b, a));
      }),
    );
  });

  it("returns sorted, disjoint, non-empty ranges", () => {
    fc.assert(
      fc.property(rangesArb, (ranges) => {
        const merged = mergeRanges(ranges);

        merged.forEach(([start, end], index) => {
          expect(end).toBeGreaterThan(start);
          expect(start).toBeGreaterThan(merged[index - 1]?.[1] ?? -1);
        });
      }),
    );
  });

  it("never covers more than the sum of its inputs", () => {
    fc.assert(
      fc.property(rangesArb, (ranges) => {
        expect(rangesLength(mergeRanges(ranges))).toBeLessThanOrEqual(rangesLength(ranges));
      }),
    );
  });
});

describe("clampRanges", () => {
  it("cuts ranges to the video and drops what falls outside", () => {
    expect(
      clampRanges(
        [
          [-5, 3],
          [8, 15],
          [20, 30],
        ],
        10,
      ),
    ).toEqual([
      [0, 3],
      [8, 10],
    ]);
  });
});

describe("computeCoverage", () => {
  it.each<[string, WatchedRange[], number, number]>([
    ["nothing watched", [], 100, 0],
    ["half watched", [[0, 50]], 100, 0.5],
    [
      "overlaps counted once",
      [
        [0, 50],
        [25, 75],
      ],
      100,
      0.75,
    ],
    ["ranges past the end clamped", [[0, 500]], 100, 1],
    ["zero duration", [[0, 5]], 0, 0],
  ])("%s", (_name, ranges, duration, expected) => {
    expect(computeCoverage(ranges, duration)).toBe(expected);
  });

  it("is always between 0 and 1", () => {
    fc.assert(
      fc.property(rangesArb, fc.integer({ min: 1, max: 900 }), (ranges, duration) => {
        const coverage = computeCoverage(ranges, duration);

        expect(coverage).toBeGreaterThanOrEqual(0);
        expect(coverage).toBeLessThanOrEqual(1);
      }),
    );
  });
});

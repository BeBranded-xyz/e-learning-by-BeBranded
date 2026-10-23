import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { derange, seededRandom, shuffle } from "./shuffle.js";

describe("seededRandom", () => {
  it("replays the same stream for the same seed", () => {
    const first = seededRandom(42);
    const second = seededRandom(42);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("gives different streams for different seeds, within [0, 1)", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
    fc.assert(
      fc.property(fc.integer({ min: -(2 ** 31), max: 2 ** 32 }), (seed) => {
        const value = seededRandom(seed)();
        return value >= 0 && value < 1;
      }),
    );
  });
});

describe("shuffle", () => {
  it("returns a permutation and leaves the input untouched", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.integer(), (items, seed) => {
        const input = [...items];
        const result = shuffle(items, seededRandom(seed));
        expect(items).toEqual(input);
        expect([...result].sort()).toEqual([...items].sort());
      }),
    );
  });

  it("actually reorders", () => {
    const items = Array.from({ length: 20 }, (_, index) => index);

    expect(shuffle(items, seededRandom(7))).not.toEqual(items);
  });
});

describe("derange", () => {
  it("never returns the reference order for two items or more", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer(), { minLength: 2, maxLength: 8 }),
        fc.integer(),
        (items, seed) => {
          const result = derange(items, seededRandom(seed), items);
          expect(result).not.toEqual(items);
          expect([...result].sort()).toEqual([...items].sort());
        },
      ),
    );
  });

  it("rotates a shuffle that came out in the reference order", () => {
    // Increasing keys keep the order, so the rotation kicks in.
    let next = 0;
    const increasing = () => (next += 0.1);

    expect(derange(["a", "b", "c"], increasing, ["a", "b", "c"])).toEqual(["b", "c", "a"]);
  });

  it("keeps a single item", () => {
    expect(derange(["a"], seededRandom(1), ["a"])).toEqual(["a"]);
  });
});

/**
 * Deterministic shuffling from a stored seed (spec 07, "Shuffling"): the
 * server opens an attempt with a seed and rebuilds the exact same order when
 * grading it. Not for anything secret: the order only has to be unpredictable
 * enough that the authored order does not give answers away.
 */

/** A 32-bit seed to a stream of numbers in [0, 1) (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A random permutation on a copy: every item gets a random key, then the keys are sorted. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  return items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

/**
 * A shuffle that never returns the reference order (for two items or more):
 * an ordering question shown in its correct order would answer itself.
 */
export function derange<T>(items: readonly T[], random: () => number, reference: readonly T[]) {
  const shuffled = shuffle(items, random);
  const same = shuffled.every((item, index) => item === reference[index]);
  return same && shuffled.length > 1 ? [...shuffled.slice(1), ...shuffled.slice(0, 1)] : shuffled;
}

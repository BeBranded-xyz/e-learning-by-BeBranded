import type { WatchedRange } from "./video.schemas.js";

function byStart(a: WatchedRange, b: WatchedRange): number {
  return a[0] - b[0] || a[1] - b[1];
}

/**
 * Sorted union of intervals: overlapping or touching intervals are joined and
 * empty ones dropped. Idempotent and commutative (spec 06, "Server side").
 */
export function mergeRanges(...lists: readonly (readonly WatchedRange[])[]): WatchedRange[] {
  const sorted = lists.flat().filter(([start, end]) => end > start);
  sorted.sort(byStart);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** Total length of intervals that do not overlap (the output of `mergeRanges`). */
export function rangesLength(ranges: readonly WatchedRange[]): number {
  return ranges.reduce((total, [start, end]) => total + (end - start), 0);
}

/** Restricts intervals to `[0, durationSeconds]`, dropping what falls outside. */
export function clampRanges(
  ranges: readonly WatchedRange[],
  durationSeconds: number,
): WatchedRange[] {
  return ranges
    .map(([start, end]): WatchedRange => [Math.max(0, start), Math.min(durationSeconds, end)])
    .filter(([start, end]) => end > start);
}

/** Watched share of the video, between 0 and 1. */
export function computeCoverage(ranges: readonly WatchedRange[], durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  const watched = rangesLength(mergeRanges(clampRanges(ranges, durationSeconds)));
  return Math.min(1, watched / durationSeconds);
}

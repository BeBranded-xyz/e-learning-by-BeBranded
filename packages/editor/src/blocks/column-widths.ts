import { COLUMN_RULES } from "@bebranded/elearning-core";

/** Width rules shared by the editor's resize handle and the renderers (spec 10). */

/** The validator's rules, plus the 5% step widths move and render by. */
export const COLUMN_LIMITS = { ...COLUMN_RULES, step: 0.05 } as const;

/** Shares of the row, normalized to sum to 1. */
export function normalizeWidths(widths: readonly number[]): number[] {
  const total = widths.reduce((sum, width) => sum + width, 0);
  return total <= 0 ? widths.map(() => 1 / widths.length) : widths.map((width) => width / total);
}

/**
 * Moves `delta` of the row from the column after `index` to the column at
 * `index` (negative: the other way), in steps, never below the minimum share.
 * Answers the new normalized widths, or the same ones when the move is impossible.
 */
export function resizeColumns(widths: readonly number[], index: number, delta: number): number[] {
  const shares = normalizeWidths(widths);
  const left = shares[index];
  const right = shares[index + 1];
  if (left === undefined || right === undefined) return shares;
  const pair = left + right;
  const wanted = Math.round((left + delta) / COLUMN_LIMITS.step) * COLUMN_LIMITS.step;
  const next = Math.min(Math.max(wanted, COLUMN_LIMITS.minShare), pair - COLUMN_LIMITS.minShare);
  if (next < COLUMN_LIMITS.minShare - 1e-9) return shares;
  return shares.map((share, position) => {
    if (position === index) return round(next);
    if (position === index + 1) return round(pair - next);
    return round(share);
  });
}

const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** A share as a whole percent in 5% steps, for markup without inline styles. */
export function widthStep(share: number): number {
  return Math.min(100, Math.max(15, Math.round((share * 100) / 5) * 5));
}

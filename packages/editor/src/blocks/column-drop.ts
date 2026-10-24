import { COLUMN_LIMITS } from "./column-widths.js";

/**
 * Creating columns by dropping blocks on another block's edge (spec 10,
 * "Editing behavior"): the pure part, decided from the blocks alone.
 */

export type DropSide = "left" | "right";

/** The outer fifth of a block, on each side, takes a drop as a new column. */
export const EDGE_SHARE = 0.2;

/** Which edge of `rect` a pointer at `clientX` is on, if any. */
export function dropSide(
  rect: { readonly left: number; readonly width: number },
  clientX: number,
): DropSide | null {
  if (rect.width <= 0) return null;
  const offset = (clientX - rect.left) / rect.width;
  if (offset < 0 || offset > 1) return null;
  if (offset < EDGE_SHARE) return "left";
  return offset > 1 - EDGE_SHARE ? "right" : null;
}

/** The fields of a BlockNote block this plan reads, whatever the schema. */
export type PlanBlock = {
  readonly id: string;
  readonly type: string;
  readonly children: readonly PlanBlock[];
};

export type ColumnDropPlan = {
  /** `create`: the target becomes a column list; `add`: the target list gets a column. */
  readonly kind: "create" | "add";
  readonly targetId: string;
  /** The block ids of each column, in order; columns are equal in width. */
  readonly columns: readonly (readonly string[])[];
};

const holdsColumns = (block: PlanBlock): boolean =>
  block.type === "columnList" || block.children.some(holdsColumns);

const contains = (block: PlanBlock, id: string): boolean =>
  block.id === id || block.children.some((child) => contains(child, id));

const ids = (blocks: readonly PlanBlock[]) => blocks.map((block) => block.id);

/**
 * What dropping `dragged` on the `side` edge of `target` does, or null when it
 * must stay an ordinary drop: no column list inside a column (spec 10), at most
 * four columns, and a block never dropped next to itself or into its own list.
 */
export function planColumnDrop(
  target: PlanBlock,
  dragged: readonly PlanBlock[],
  side: DropSide,
): ColumnDropPlan | null {
  if (dragged.length === 0 || dragged.some(holdsColumns)) return null;
  if (dragged.some((block) => contains(block, target.id) || contains(target, block.id)))
    return null;
  if (target.type === "column") return null;
  const moved = ids(dragged);
  if (target.type === "columnList") {
    const existing = target.children.map((column) => ids(column.children));
    if (existing.length >= COLUMN_LIMITS.max) return null;
    const columns = side === "left" ? [moved, ...existing] : [...existing, moved];
    return { kind: "add", targetId: target.id, columns };
  }
  if (holdsColumns(target)) return null;
  const columns = side === "left" ? [moved, [target.id]] : [[target.id], moved];
  return { kind: "create", targetId: target.id, columns };
}

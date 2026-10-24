import { createBlockSpec } from "@blocknote/core";

import { COLUMN_LIMITS, resizeColumns } from "./column-widths.js";

/**
 * Multi-column layout (spec 10, ADR-0001), built on BlockNote's public
 * layout block API (MPL-2.0 core): a `columnList` holds 2 to 4 `column`
 * blocks side by side, and a column holds any block except another column
 * list. BlockNote keeps nesting, drag and drop, cursor movement and undo;
 * our JSON format is our own (spec 10, clean-room rules).
 */

export const createColumnList = createBlockSpec(
  {
    type: "columnList",
    propSchema: {},
    content: "none",
    layoutOnly: true,
    // Fewer than two columns dissolves the list: its blocks return to the flow.
    children: { allow: ["column"], min: COLUMN_LIMITS.min, dissolve: true },
  },
  {
    renderFrame: () => {
      const dom = document.createElement("div");
      dom.className = "el-columns";
      return { dom, slot: dom };
    },
  },
);

type ColumnBlock = { readonly id: string; readonly props: { readonly width: number } };

const isColumn = (block: { type: string; props: unknown }): block is ColumnBlock & typeof block =>
  block.type === "column" &&
  typeof block.props === "object" &&
  block.props !== null &&
  "width" in block.props &&
  typeof block.props.width === "number";

/** What resizing needs from the editor, whatever schema holds the columns. */
type ColumnEditor = {
  getParentBlock(
    id: string,
  ): { type: string; children: { type: string; props: unknown; id: string }[] } | undefined;
  transact(change: () => void): void;
  updateBlock(id: string, update: { props: { width: number } }): unknown;
};

/** Applies new widths to a column and its right neighbour in one undo step. */
function resize(editor: ColumnEditor, columnId: string, delta: number): void {
  const list = editor.getParentBlock(columnId);
  if (list?.type !== "columnList") return;
  const siblings = list.children.filter(isColumn);
  const index = siblings.findIndex((sibling) => sibling.id === columnId);
  const widths = resizeColumns(
    siblings.map((sibling) => sibling.props.width),
    index,
    delta,
  );
  editor.transact(() => {
    siblings.forEach((sibling, position) => {
      editor.updateBlock(sibling.id, { props: { width: widths[position] ?? sibling.props.width } });
    });
  });
}

/**
 * The handle between a column and the next one: drag it, or focus it and use
 * the arrow keys (5% of the row per press). It is chrome, outside the slot.
 */
function resizeHandle(editor: ColumnEditor, columnId: string, label: string): HTMLElement {
  const handle = document.createElement("div");
  handle.className = "el-column-resize";
  handle.tabIndex = 0;
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", label);
  handle.contentEditable = "false";
  handle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    resize(editor, columnId, event.key === "ArrowRight" ? COLUMN_LIMITS.step : -COLUMN_LIMITS.step);
  });
  handle.addEventListener("pointerdown", (start) => {
    const row = handle.closest(".el-columns");
    if (!(row instanceof HTMLElement)) return;
    start.preventDefault();
    let origin = start.clientX;
    const move = (event: PointerEvent) => {
      const delta = (event.clientX - origin) / row.getBoundingClientRect().width;
      if (Math.abs(delta) < COLUMN_LIMITS.step) return;
      resize(editor, columnId, delta);
      origin = event.clientX;
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  });
  return handle;
}

export type ColumnOptions = {
  /** The resize handle's accessible name, in the editor's language. */
  readonly resizeLabel: string;
};

/** One column; `width` is its share of the row, normalized when rendered. */
export const createColumn = createBlockSpec<
  "column",
  { readonly width: { readonly default: number } },
  "none",
  ColumnOptions
>(
  {
    type: "column",
    propSchema: { width: { default: 1 } },
    content: "none",
    layoutOnly: true,
    placeable: "namedOnly",
    children: { exclude: ["columnList"] },
  },
  (options: Partial<ColumnOptions>) => ({
    renderFrame: (block, editor) => {
      const dom = document.createElement("div");
      dom.className = "el-column";
      dom.style.flexGrow = String(block.props.width);
      const slot = document.createElement("div");
      slot.className = "el-column-content";
      dom.append(slot, resizeHandle(editor, block.id, options.resizeLabel ?? "Resize columns"));
      return {
        dom,
        slot,
        update: (next) => {
          dom.style.flexGrow = String(next.props.width);
          return true;
        },
      };
    },
  }),
);

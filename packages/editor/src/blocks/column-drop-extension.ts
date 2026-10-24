import { createExtension } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";

import { dropSide, planColumnDrop } from "./column-drop.js";
import type { ColumnDropPlan, DropSide, PlanBlock } from "./column-drop.js";
import { DropIndicator } from "./column-drop-indicator.js";

/**
 * Dropping blocks dragged with BlockNote's handle on the left or right edge of
 * a top-level block makes columns (spec 10). A ProseMirror plugin: over an
 * edge, `dragover` accepts the drop and shows the edge, and `handleDrop` makes
 * the columns before ProseMirror inserts anything. Every other drag and drop
 * goes on untouched.
 */

export const columnDropKey = new PluginKey("elearningColumnDrop");

type View = BlockNoteEditor["prosemirrorView"];
type Fragment = NonNullable<View["dragging"]>["slice"]["content"];

/** What the plugin needs from the editor, whatever its schema. */
type DropEditor = {
  getBlock(id: string): (PlanBlock & object) | undefined;
  removeBlocks(ids: string[]): unknown;
  replaceBlocks(ids: string[], blocks: object[]): unknown;
  transact(change: () => void): unknown;
};

type Pending = {
  readonly element: HTMLElement;
  readonly side: DropSide;
  readonly plan: ColumnDropPlan;
};

const BLOCK_ELEMENTS = '[data-node-type="blockOuter"], [data-node-type="columnList"]';

/** The top-level block element under the pointer: a block of the root group, or a column list. */
function topLevelElement(view: View, target: EventTarget | null): HTMLElement | null {
  const root = view.dom.querySelector('[data-node-type="blockGroup"]');
  let element = target instanceof Element ? target.closest(BLOCK_ELEMENTS) : null;
  while (element !== null && element.parentElement !== root) {
    element = element.parentElement?.closest(BLOCK_ELEMENTS) ?? null;
  }
  return element instanceof HTMLElement ? element : null;
}

/** The outermost blocks of the dragged slice: wrappers without an id (block groups) are looked into. */
function blockIds(fragment: Fragment, ids: string[]): string[] {
  fragment.forEach((node) => {
    if (typeof node.attrs.id === "string") ids.push(node.attrs.id);
    else blockIds(node.content, ids);
  });
  return ids;
}

function draggedBlocks(editor: DropEditor, view: View) {
  const slice = view.dragging?.slice;
  const ids = slice === undefined ? [] : blockIds(slice.content, []);
  return ids.map((id) => editor.getBlock(id)).filter((block) => block !== undefined);
}

function pending(editor: DropEditor, view: View, event: DragEvent): Pending | null {
  const element = topLevelElement(view, event.target);
  const target = element === null ? undefined : editor.getBlock(element.dataset.id ?? "");
  const side = element === null ? null : dropSide(element.getBoundingClientRect(), event.clientX);
  if (element === null || target === undefined || side === null) return null;
  const plan = planColumnDrop(target, draggedBlocks(editor, view), side);
  return plan === null ? null : { element, side, plan };
}

/** One undo step: the dragged blocks leave their place, the target becomes (or gets) columns. */
function apply(editor: DropEditor, plan: ColumnDropPlan, dragged: readonly { id: string }[]) {
  // Read every block before the removal changes the document.
  const columns = plan.columns.map((column) => ({
    type: "column",
    props: { width: 1 },
    children: column.map((id) => editor.getBlock(id)).filter((block) => block !== undefined),
  }));
  editor.transact(() => {
    editor.removeBlocks(dragged.map((block) => block.id));
    editor.replaceBlocks(
      [plan.targetId],
      [{ id: plan.targetId, type: "columnList", children: columns }],
    );
  });
}

/** Browsers leave relatedTarget empty on drag events: the pointer's position says whether it left. */
function leftEditor(view: View, event: DragEvent): boolean {
  const rect = view.dom.getBoundingClientRect();
  const inside =
    event.clientX > rect.left &&
    event.clientX < rect.right &&
    event.clientY > rect.top &&
    event.clientY < rect.bottom;
  return !inside;
}

function columnDropPlugin(editor: DropEditor): Plugin {
  const indicator = new DropIndicator();
  return new Plugin({
    key: columnDropKey,
    view: () => ({
      destroy: () => {
        indicator.destroy();
      },
    }),
    props: {
      handleDOMEvents: {
        // Ours: accept the drop here, and show the edge instead of a drop cursor.
        dragover: (view, event) => {
          const drop = pending(editor, view, event);
          if (drop === null) {
            indicator.hide();
            return false;
          }
          indicator.show(view.dom, drop.element, drop.side);
          event.preventDefault();
          // BlockNote's drag allows "move" only: any other effect and the browser drops nothing.
          if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
          return true;
        },
        dragleave: (view, event) => {
          if (leftEditor(view, event)) indicator.hide();
          return false;
        },
        dragend: () => {
          indicator.hide();
          return false;
        },
      },
      handleDrop: (view, event) => {
        const drop = pending(editor, view, event);
        indicator.hide();
        if (drop === null) return false;
        event.preventDefault();
        apply(editor, drop.plan, draggedBlocks(editor, view));
        view.dragging = null;
        return true;
      },
    },
  });
}

export const columnDropExtension = createExtension(({ editor }) => ({
  key: "elearningColumnDrop",
  prosemirrorPlugins: [columnDropPlugin(editor)],
}));

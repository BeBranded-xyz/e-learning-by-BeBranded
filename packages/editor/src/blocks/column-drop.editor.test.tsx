import { BlockNoteEditor } from "@blocknote/core";
import { beforeAll, describe, expect, it } from "vitest";

import { lessonEditorSchema } from "../schema.js";
import { columnDropKey } from "./column-drop-extension.js";

type Editor = BlockNoteEditor<typeof lessonEditorSchema.blockSchema>;

// jsdom has no elementFromPoint; BlockNote's document-level drop handler asks it where a drop lands.
beforeAll(() => {
  document.elementFromPoint = () => null;
});

function mounted(blocks: Parameters<Editor["replaceBlocks"]>[1]) {
  const editor = BlockNoteEditor.create({ schema: lessonEditorSchema });
  const host = document.createElement("div");
  // The module's root, where the editor's drop indicator goes.
  host.className = "el-root";
  document.body.append(host);
  editor.mount(host);
  editor.replaceBlocks(editor.document, blocks);
  return Object.assign(editor, { host });
}

const paragraphs = () =>
  mounted(["A", "B", "C"].map((text) => ({ type: "paragraph" as const, content: text })));

const idOf = (editor: Editor, text: string) =>
  editor.document.find((block) => JSON.stringify(block.content).includes(`"${text}"`))?.id ?? "";

/** What BlockNote's drag handle sets: the dragged block as ProseMirror's drag slice. */
function startDrag(editor: Editor, id: string) {
  const view = editor.prosemirrorView;
  view.state.doc.descendants((node, pos) => {
    if (node.attrs.id === id && view.dragging === null) {
      view.dragging = { slice: view.state.doc.slice(pos, pos + node.nodeSize), move: true };
    }
    return view.dragging === null;
  });
}

/** A block element 500px wide at x 0, so its edges are below 100px and above 400px. */
function blockElement(host: HTMLElement, id: string, type = "blockOuter") {
  const element = host.querySelector(`[data-node-type="${type}"][data-id="${id}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`no element for ${id}`);
  element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 500, height: 40 });
  return element;
}

type Fired = { readonly event: MouseEvent; readonly handled: boolean };

/**
 * Fires a drag event on a block and hands it to the plugin as ProseMirror
 * would (its drop handler needs a real browser's dataTransfer, so the test
 * calls the plugin's handlers itself), then stops it there.
 */
function fire(
  editor: Editor,
  type: "dragover" | "drop" | "dragleave" | "dragend",
  element: Element,
  at:
    | number
    | { readonly clientX: number; readonly clientY?: number; readonly dataTransfer?: boolean } = 0,
): Fired {
  const options = typeof at === "number" ? { clientX: at } : at;
  const view = editor.prosemirrorView;
  const plugin = columnDropKey.get(view.state);
  if (plugin === undefined) throw new Error("the column drop plugin is not installed");
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: options.clientX,
    clientY: options.clientY ?? 0,
  });
  // A browser drag event carries a dataTransfer; listeners on the way read its types.
  Object.defineProperty(event, "dataTransfer", {
    value:
      "dataTransfer" in options && options.dataTransfer === false
        ? null
        : { types: [], getData: () => "", dropEffect: "none", effectAllowed: "move" },
  });
  let handled = false;
  const target = element.querySelector("p") ?? element;
  target.addEventListener(
    type,
    () => {
      event.stopPropagation();
      const { props } = plugin;
      if (type === "drop") {
        handled =
          props.handleDrop?.call(
            plugin,
            view,
            event as DragEvent,
            view.state.doc.slice(0, 0),
            true,
          ) ?? false;
      } else {
        handled = props.handleDOMEvents?.[type]?.call(plugin, view, event as DragEvent) ?? false;
      }
    },
    { once: true },
  );
  target.dispatchEvent(event);
  return { event, handled };
}

/** The edge indicator in the module's root: which side it shows, or hidden (never shown counts). */
function indicator(editor: Editor & { host: HTMLElement }) {
  const element = editor.host.querySelector(".el-column-drop-indicator");
  if (!(element instanceof HTMLElement)) return "hidden";
  return element.hidden ? "hidden" : (element.dataset.side ?? "");
}

/** The first letter of a block's text, the test's way to name blocks. */
const letter = (content: unknown) => /"text":"(\w)"/.exec(JSON.stringify(content))?.[1];

const texts = (editor: Editor) =>
  editor.document.map((block) =>
    block.type === "columnList"
      ? block.children.map((column) => column.children.map((child) => letter(child.content)))
      : letter(block.content),
  );

describe("dropping a block on another block's edge", () => {
  it("makes two columns, the dropped block on the right", () => {
    const editor = paragraphs();
    const target = blockElement(editor.host, idOf(editor, "B"));
    startDrag(editor, idOf(editor, "A"));

    fire(editor, "dragover", target, 480);
    expect(indicator(editor)).toBe("right");
    expect(fire(editor, "drop", target, 480).handled).toBe(true);

    expect(texts(editor)).toEqual([[["B"], ["A"]], "C"]);
    expect(editor.prosemirrorView.dragging).toBeNull();
    expect(indicator(editor)).toBe("hidden");
  });

  it("puts the dropped block on the left from the left edge, in one undo step", () => {
    const editor = paragraphs();
    const target = blockElement(editor.host, idOf(editor, "C"));
    startDrag(editor, idOf(editor, "A"));

    fire(editor, "drop", target, 10);
    expect(texts(editor)).toEqual(["B", [["A"], ["C"]]]);

    editor.undo();
    expect(texts(editor)).toEqual(["A", "B", "C"]);
  });

  it("leaves a drop in the middle of a block to BlockNote", () => {
    const editor = paragraphs();
    const target = blockElement(editor.host, idOf(editor, "B"));
    startDrag(editor, idOf(editor, "A"));

    fire(editor, "dragover", target, 250);
    expect(indicator(editor)).toBe("hidden");
    expect(fire(editor, "drop", target, 250).handled).toBe(false);
    expect(texts(editor)).toEqual(["A", "B", "C"]);
  });

  it("ignores drags that are not BlockNote block drags", () => {
    const editor = paragraphs();
    const target = blockElement(editor.host, idOf(editor, "B"));

    fire(editor, "dragover", target, 480);

    expect(indicator(editor)).toBe("hidden");
    expect(fire(editor, "drop", target, 480).handled).toBe(false);
  });

  it("clears the edge marker when the drag leaves the editor", () => {
    const editor = paragraphs();
    const target = blockElement(editor.host, idOf(editor, "B"));
    startDrag(editor, idOf(editor, "A"));
    fire(editor, "dragover", target, 480);

    fire(editor, "dragleave", target);

    expect(indicator(editor)).toBe("hidden");
  });

  it("adds a column to a column list, from any of its blocks near the list's edge", () => {
    const editor = mounted([
      { type: "paragraph", content: "A" },
      {
        type: "columnList",
        children: [
          { type: "column", children: [{ type: "paragraph", content: "L" }] },
          { type: "column", children: [{ type: "paragraph", content: "R" }] },
        ],
      },
    ]);
    const listId = editor.document[1]?.id ?? "";
    blockElement(editor.host, listId, "columnList");
    const insideRight = blockElement(
      editor.host,
      editor.document[1]?.children[1]?.children[0]?.id ?? "",
    );
    startDrag(editor, idOf(editor, "A"));

    fire(editor, "drop", insideRight, 480);

    expect(texts(editor)).toEqual([[["L"], ["R"], ["A"]]]);
    expect(editor.document[0]?.id).toBe(listId);
  });

  it("finds the dragged blocks inside a wrapping block group", () => {
    const editor = paragraphs();
    const view = editor.prosemirrorView;
    let end = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.attrs.id === idOf(editor, "A")) end = pos + node.nodeSize;
      return end === 0;
    });
    // From the document's start: the slice's outer node is the root block group, which has no id.
    view.dragging = { slice: view.state.doc.slice(0, end), move: true };

    fire(editor, "drop", blockElement(editor.host, idOf(editor, "C")), 480);

    expect(texts(editor)).toEqual(["B", [["C"], ["A"]]]);
  });

  it("accepts the drop and says move, even when the event carries no dataTransfer", () => {
    const editor = paragraphs();
    const target = blockElement(editor.host, idOf(editor, "B"));
    startDrag(editor, idOf(editor, "A"));

    const plain = fire(editor, "dragover", target, { clientX: 480, dataTransfer: false });
    const full = fire(editor, "dragover", target, 480);

    expect(plain).toMatchObject({ handled: true });
    expect(plain.event.defaultPrevented).toBe(true);
    expect((full.event as DragEvent).dataTransfer?.dropEffect).toBe("move");
  });

  it("keeps the edge shown while the drag moves inside the editor, and hides it at drag end", () => {
    const editor = paragraphs();
    const target = blockElement(editor.host, idOf(editor, "B"));
    editor.prosemirrorView.dom.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: 0, width: 800, height: 600 });
    startDrag(editor, idOf(editor, "A"));
    fire(editor, "dragover", target, 480);

    fire(editor, "dragleave", target, { clientX: 300, clientY: 20 });
    expect(indicator(editor)).toBe("right");

    fire(editor, "dragend", target);
    expect(indicator(editor)).toBe("hidden");
  });

  it("removes its indicator with the editor's view", () => {
    const editor = paragraphs();
    startDrag(editor, idOf(editor, "A"));
    fire(editor, "dragover", blockElement(editor.host, idOf(editor, "B")), 480);
    const plugin = columnDropKey.get(editor.prosemirrorView.state);

    plugin?.spec.view?.(editor.prosemirrorView).destroy?.();

    expect(editor.host.querySelector(".el-column-drop-indicator")).toBeNull();
  });

  it("puts the indicator in the page when the editor is outside the module's root", () => {
    const editor = paragraphs();
    editor.host.className = "";
    startDrag(editor, idOf(editor, "A"));

    fire(editor, "dragover", blockElement(editor.host, idOf(editor, "B")), 480);

    expect(document.body.lastElementChild?.className).toBe("el-column-drop-indicator");
  });

  it("shows the left edge when the drop would go left", () => {
    const editor = paragraphs();
    startDrag(editor, idOf(editor, "A"));

    fire(editor, "dragover", blockElement(editor.host, idOf(editor, "C")), 10);

    expect(indicator(editor)).toBe("left");
  });

  it("ignores drags over no block: the editor's own element, a text node, a block without id", () => {
    const editor = paragraphs();
    startDrag(editor, idOf(editor, "A"));
    const view = editor.prosemirrorView;
    const plugin = columnDropKey.get(view.state);
    const target = blockElement(editor.host, idOf(editor, "B"));
    const text = target.querySelector("p")?.firstChild ?? null;
    // jsdom cannot dispatch drag events to a text node: a drag event whose target says so.
    const onText = new MouseEvent("dragover", { clientX: 480 });
    Object.defineProperty(onText, "target", { value: text });

    const overEditor = fire(editor, "dragover", view.dom, 480);
    const overText = plugin?.props.handleDOMEvents?.dragover?.call(
      plugin,
      view,
      onText as DragEvent,
    );
    target.removeAttribute("data-id");
    const overAnonymous = fire(editor, "dragover", target, 480);

    expect([overEditor.handled, overText, overAnonymous.handled]).toEqual([false, false, false]);
    expect(indicator(editor)).toBe("hidden");
  });
});

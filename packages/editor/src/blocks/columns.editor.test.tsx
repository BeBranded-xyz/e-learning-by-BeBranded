import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import { createLessonEditorSchema, lessonEditorSchema, quizEditorSchema } from "../schema.js";

type Editor = ReturnType<typeof mounted>;

function mounted(schema = lessonEditorSchema) {
  const editor = BlockNoteEditor.create({ schema });
  const host = document.createElement("div");
  document.body.append(host);
  editor.mount(host);
  editor.replaceBlocks(editor.document, [
    {
      type: "columnList",
      children: [
        { type: "column", props: { width: 1 }, children: [{ type: "paragraph", content: "Left" }] },
        {
          type: "column",
          props: { width: 1 },
          children: [{ type: "paragraph", content: "Right" }],
        },
      ],
    },
  ]);
  return Object.assign(editor, { host });
}

const widths = (editor: Editor) =>
  editor.document[0]?.children.map((column) =>
    "width" in column.props ? column.props.width : null,
  );
const handles = (editor: { readonly host: HTMLElement }): HTMLElement[] => [
  ...editor.host.querySelectorAll<HTMLElement>(".el-column-resize"),
];

describe("column blocks", () => {
  it("hold blocks side by side, each column with a resize handle", () => {
    const editor = mounted();

    expect(editor.host.querySelectorAll(".el-columns > .el-column")).toHaveLength(2);
    expect(editor.host.querySelector(".el-column .el-column-content p")?.textContent).toBe("Left");
    expect(handles(editor)[0]?.getAttribute("role")).toBe("separator");
  });

  it("resize with the arrow keys, 5% per press, as one undo step", () => {
    const editor = mounted();

    handles(editor)[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(widths(editor)).toEqual([0.55, 0.45]);
    handles(editor)[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    handles(editor)[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    expect(widths(editor)).toEqual([0.45, 0.55]);

    editor.undo();
    expect(widths(editor)).toEqual([0.5, 0.5]);
  });

  it("resize by dragging the handle, in 5% steps of the row's width", () => {
    const editor = mounted();
    const row = editor.host.querySelector(".el-columns");
    if (!(row instanceof HTMLElement)) throw new Error("no row");
    row.getBoundingClientRect = () => DOMRect.fromRect({ width: 1000, height: 100 });
    const handle = handles(editor)[0];

    handle?.dispatchEvent(new MouseEvent("pointerdown", { clientX: 500, bubbles: true }));
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 520 }));
    expect(widths(editor)).toEqual([1, 1]);
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 600 }));
    expect(widths(editor)).toEqual([0.6, 0.4]);
    window.dispatchEvent(new MouseEvent("pointerup", {}));
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 900 }));

    expect(widths(editor)).toEqual([0.6, 0.4]);
  });

  it("ignore other keys on the handle", () => {
    const editor = mounted();

    handles(editor)[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(widths(editor)).toEqual([1, 1]);
  });

  it("dissolve into their blocks when one column is left", () => {
    const editor = mounted();
    const second = editor.document[0]?.children[1];
    if (second !== undefined) editor.removeBlocks([second]);

    expect(editor.document.map((block) => block.type)).toEqual(["paragraph"]);
  });

  it("refuse a column list inside a column", () => {
    const editor = mounted();
    const column = editor.document[0]?.children[0];

    expect(() => {
      if (column !== undefined) {
        editor.insertBlocks(
          [{ type: "columnList", children: [{ type: "column" }, { type: "column" }] }],
          column.children[0] ?? column,
          "after",
        );
      }
    }).toThrow();
  });

  it("name the resize handle in the editor's language", () => {
    const english = mounted();
    const french = mounted(
      createLessonEditorSchema({ columnResizeLabel: "Redimensionner les colonnes" }),
    );

    expect(handles(english)[0]?.getAttribute("aria-label")).toBe("Resize columns");
    expect(handles(french)[0]?.getAttribute("aria-label")).toBe("Redimensionner les colonnes");
  });

  it("are not part of the quiz editor", () => {
    expect(Object.keys(quizEditorSchema.blockSchema)).not.toContain("columnList");
  });
});

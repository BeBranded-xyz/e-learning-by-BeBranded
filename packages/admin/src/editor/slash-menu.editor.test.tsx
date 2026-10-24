import { BlockNoteEditor } from "@blocknote/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { lessonEditorSchema, quizEditorSchema } from "@bebranded/elearning-editor";

import { createAdminI18n } from "../i18n/admin-translator.js";
import { useAdmin } from "../provider/admin-context.js";
import { insertQuestion, lessonSlashItems, quizSlashItems } from "./slash-menu.js";

const t = createAdminI18n("en");

function mounted<S extends typeof lessonEditorSchema | typeof quizEditorSchema>(schema: S) {
  const editor = BlockNoteEditor.create({ schema });
  const host = document.createElement("div");
  document.body.append(host);
  editor.mount(host);
  return editor;
}

describe("lessonSlashItems", () => {
  it("offers images and files but no heading 4 to 6, audio or video", async () => {
    const titles = (await lessonSlashItems(mounted(lessonEditorSchema), "")).map(
      (item) => item.title,
    );

    expect(titles).toEqual(expect.arrayContaining(["Image", "File", "Heading 3", "Table"]));
    expect(titles).not.toEqual(expect.arrayContaining(["Heading 4"]));
    expect(titles).not.toContain("Video");
    expect(titles).not.toContain("Audio");
  });

  it("filters by the typed query", async () => {
    const titles = (await lessonSlashItems(mounted(lessonEditorSchema), "imag")).map(
      (item) => item.title,
    );

    expect(titles).toEqual(["Image"]);
  });
});

describe("quizSlashItems", () => {
  it("lists the six question types first, then the lesson blocks", async () => {
    const items = await quizSlashItems(mounted(quizEditorSchema), "", t);

    expect(items.slice(0, 6).map((item) => item.title)).toEqual([
      "Single choice question",
      "Multiple choice question",
      "True or false question",
      "Short answer question",
      "Ordering question",
      "Matching question",
    ]);
    expect(items.map((item) => item.title)).toContain("Paragraph");
  });

  it("turns the empty line into the picked question", async () => {
    const editor = mounted(quizEditorSchema);
    const [item] = await quizSlashItems(editor, "true or false", t);

    item?.onItemClick();

    expect(editor.document.map((block) => block.type)).toEqual(["trueFalseQuestion"]);
    expect(editor.getTextCursorPosition().block.type).toBe("trueFalseQuestion");
  });
});

describe("insertQuestion", () => {
  it("adds the question after a line that has text, and moves the cursor into it", () => {
    const editor = mounted(quizEditorSchema);
    const [first] = editor.document;
    if (first !== undefined) editor.updateBlock(first, { content: "Context" });

    insertQuestion(editor, "shortAnswerQuestion");

    expect(editor.document.map((block) => block.type).slice(0, 2)).toEqual([
      "paragraph",
      "shortAnswerQuestion",
    ]);
    expect(editor.getTextCursorPosition().block.type).toBe("shortAnswerQuestion");
  });
});

function Outside() {
  useAdmin();
  return null;
}

describe("useAdmin", () => {
  it("explains a missing provider", () => {
    expect(() => render(<Outside />)).toThrow(
      "Wrap back-office components in <ElearningAdminProvider>.",
    );
    expect(screen.queryByText("x")).toBeNull();
  });
});

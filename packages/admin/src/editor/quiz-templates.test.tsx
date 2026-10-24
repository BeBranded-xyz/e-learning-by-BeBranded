import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import { editorDocumentToQuiz } from "@bebranded/elearning-core";
import { quizEditorSchema } from "@bebranded/elearning-editor";

import { QUESTION_TYPES, isQuestionType, questionTemplate } from "./quiz-templates.js";

/** A headless quiz editor (no view), as the back-office creates it. */
function editorWith(type: (typeof QUESTION_TYPES)[number]) {
  const editor = BlockNoteEditor.create({ schema: quizEditorSchema });
  editor.replaceBlocks(editor.document, [questionTemplate(type)]);
  const [question] = editor.document;
  if (question === undefined) throw new Error("no block");
  editor.updateBlock(question, { content: "Which one is right?" });
  return editor;
}

describe("questionTemplate", () => {
  it.each(QUESTION_TYPES)("gives a %s that the server accepts once its answer is set", (type) => {
    const editor = editorWith(type);
    const [question] = editor.document;
    const first = question?.children[0];
    if (first !== undefined && "correct" in first.props)
      editor.updateBlock(first, { props: { correct: true } });

    const result = editorDocumentToQuiz(JSON.parse(JSON.stringify(editor.document)));

    expect(result.ok).toBe(true);
  });

  it("recognizes question types", () => {
    expect(isQuestionType("trueFalseQuestion")).toBe(true);
    expect(isQuestionType("paragraph")).toBe(false);
  });
});

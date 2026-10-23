// @vitest-environment jsdom
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import { QUESTION_BLOCK_TYPES, editorDocumentToQuiz } from "@bebranded/elearning-core";

import { quizEditorSchema } from "../schema.js";

function editorWith(
  blocks: Parameters<BlockNoteEditor<typeof quizEditorSchema.blockSchema>["replaceBlocks"]>[1],
) {
  const editor = BlockNoteEditor.create({ schema: quizEditorSchema });
  editor.replaceBlocks(editor.document, blocks);
  return editor;
}

const quiz = [
  { type: "paragraph" as const, content: "Read the sheet first." },
  {
    type: "singleChoiceQuestion" as const,
    props: { explanation: "CO2 does not conduct electricity." },
    content: "Which extinguisher suits an electrical fire?",
    children: [
      { type: "quizChoice" as const, content: "Water" },
      { type: "quizChoice" as const, props: { correct: true }, content: "CO2" },
    ],
  },
  {
    type: "multipleChoiceQuestion" as const,
    props: { points: 2, partialCredit: true },
    content: "What protects you?",
    children: [
      { type: "quizChoice" as const, props: { correct: true }, content: "Gloves" },
      { type: "quizChoice" as const, content: "Sandals" },
    ],
  },
  {
    type: "trueFalseQuestion" as const,
    props: { answer: false },
    content: "Lifts are safe in a fire.",
  },
  {
    type: "shortAnswerQuestion" as const,
    content: "Where do you gather?",
    children: [{ type: "quizAnswer" as const, content: "Assembly point" }],
  },
  {
    type: "orderingQuestion" as const,
    content: "Put the steps in order.",
    children: [
      { type: "quizItem" as const, content: "Alarm" },
      { type: "quizItem" as const, content: "Evacuate" },
    ],
  },
  {
    type: "matchingQuestion" as const,
    content: "Match the colors.",
    children: [
      { type: "quizPair" as const, props: { match: "Fire" }, content: "Red" },
      { type: "quizPair" as const, props: { match: "Safe" }, content: "Green" },
    ],
  },
];

describe("quiz editor schema", () => {
  it("defines a block for every question type the validator accepts", () => {
    const types = Object.keys(quizEditorSchema.blockSchema);

    expect(types).toEqual(
      expect.arrayContaining([
        ...QUESTION_BLOCK_TYPES,
        "quizChoice",
        "quizAnswer",
        "quizItem",
        "quizPair",
        "callout",
      ]),
    );
  });

  it("produces documents that the core validator turns into a quiz", () => {
    const editor = editorWith(quiz);

    const result = editorDocumentToQuiz(JSON.parse(JSON.stringify(editor.document)));

    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.questions.map((question) => question.kind)).toEqual([
      "single_choice",
      "multiple_choice",
      "true_false",
      "short_answer",
      "ordering",
      "matching",
    ]);
    expect(result.value.questions[0]).toMatchObject({
      prompt: "Which extinguisher suits an electrical fire?",
      points: 1,
      explanation: "CO2 does not conduct electricity.",
      intro: [{ type: "paragraph" }],
    });
    expect(result.value.questions[1]).toMatchObject({ points: 2, partialCredit: true });
    expect(result.value.questions[5]).toMatchObject({
      pairs: [
        { left: "Red", right: "Fire" },
        { left: "Green", right: "Safe" },
      ],
    });
  });

  it("gives new blocks the defaults the validator expects", () => {
    const editor = editorWith([
      { type: "trueFalseQuestion", content: "Is it?" },
      { type: "quizChoice" },
    ]);

    expect(editor.document[0]?.props).toEqual({ points: 1, explanation: "", answer: true });
    expect(editor.document[1]?.props).toEqual({ correct: false });
  });

  it("renders questions with their type label and options with their state", () => {
    const editor = editorWith(quiz);

    const html = editor.blocksToFullHTML(editor.document);

    expect(html).toContain('data-question-type="singleChoiceQuestion"');
    expect(html).toContain("Single choice");
    expect(html).toContain("Matching");
    expect(html).toContain('class="el-quiz-choice" data-correct="true"');
    expect(html).toContain('data-match="Fire"');
    expect(html).toContain('class="el-quiz-answer"');
    expect(html).toContain('class="el-quiz-item"');
  });
});

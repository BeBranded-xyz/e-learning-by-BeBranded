import { describe, expect, it } from "vitest";

import { paragraph, text } from "../../tests/fixtures/lesson-documents.js";
import {
  accepted,
  choice,
  fullQuizDocument,
  matching,
  multipleChoice,
  ordering,
  questionBlock,
  shortAnswer,
  singleChoice,
  trueFalse,
} from "../../tests/fixtures/quiz-documents.js";
import { LESSON_DOCUMENT_LIMITS } from "../content/lesson-document.schemas.js";
import type { InlineContent } from "../content/lesson-document.types.js";
import { editorDocumentToQuiz, plainText, questionProblem } from "./quiz-document.js";
import { QUIZ_LIMITS } from "./quiz.schemas.js";

function definitionOf(document: unknown) {
  const result = editorDocumentToQuiz(document);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function issuesOf(document: unknown) {
  const result = editorDocumentToQuiz(document);
  if (result.ok) throw new Error("expected issues");
  return result.error;
}

describe("editorDocumentToQuiz", () => {
  it("derives one graded question per question block, of every type", () => {
    const definition = definitionOf(fullQuizDocument);

    expect(definition.questions.map((question) => question.kind)).toEqual([
      "single_choice",
      "multiple_choice",
      "true_false",
      "short_answer",
      "ordering",
      "matching",
    ]);
    expect(definition.questions[0]).toEqual({
      id: "single",
      kind: "single_choice",
      prompt: "Which extinguisher suits an electrical fire?",
      points: 1,
      explanation: "CO2 does not conduct electricity.",
      intro: [paragraph("intro", [text("Read the safety sheet first.")])],
      options: [
        { id: "single-a", text: "Water" },
        { id: "single-b", text: "CO2" },
        { id: "single-c", text: "Foam" },
      ],
      correctOptionId: "single-b",
    });
  });

  it("keeps the answers of each question type", () => {
    const [, multiple, truth, short, order, match] = definitionOf(fullQuizDocument).questions;

    expect(multiple).toMatchObject({
      correctOptionIds: ["multiple-a", "multiple-b", "multiple-d"],
      partialCredit: false,
      points: 2,
    });
    expect(truth).toMatchObject({ answer: true });
    expect(short).toMatchObject({ acceptedAnswers: ["Assembly point", "Muster point"] });
    expect(order).toMatchObject({
      items: [
        { id: "ordering-a", text: "Raise the alarm" },
        { id: "ordering-b", text: "Evacuate" },
        { id: "ordering-c", text: "Gather" },
      ],
    });
    expect(match).toMatchObject({
      pairs: [
        { id: "matching-a", left: "Red", right: "Fire" },
        { id: "matching-b", left: "Blue", right: "Mandatory" },
        { id: "matching-c", left: "Green", right: "Safe condition" },
      ],
    });
  });

  it("attaches context blocks to the next question and keeps trailing ones as the outro", () => {
    const definition = definitionOf(fullQuizDocument);

    expect(definition.questions[1]?.intro).toEqual([]);
    expect(definition.questions[5]?.intro).toEqual([
      paragraph("context", [text("Look at the signs below.")]),
    ]);
    expect(definition.outro).toEqual([paragraph("outro", [text("Well done.")])]);
  });

  it("flattens formatting and links of prompts and options into plain text", () => {
    const block = questionBlock("trueFalseQuestion", "styled", { props: { answer: false } });
    block.content = [
      text("  Is   this ", { bold: true }),
      { type: "link", href: "https://example.com", content: [text("safe")] },
      text("? "),
    ] as typeof block.content;

    expect(definitionOf([block]).questions[0]?.prompt).toBe("Is this safe?");
  });

  it("refuses a document without questions", () => {
    expect(issuesOf([paragraph("p")])).toEqual([
      { code: "no_questions", message: "Add a question", path: [] },
    ]);
    expect(issuesOf([])[0]?.code).toBe("no_questions");
  });

  it("refuses more questions than the limit", () => {
    const many = Array.from({ length: QUIZ_LIMITS.maxQuestions + 1 }, (_, index) =>
      trueFalse(`q${index}`),
    );

    expect(issuesOf(many)[0]?.code).toBe("too_many_questions");
  });

  it("applies the lesson document checks first", () => {
    expect(issuesOf({ blocks: [] })[0]).toMatchObject({
      code: "invalid_content",
      message: "A quiz document is an array of blocks",
    });
    expect(issuesOf([trueFalse("same"), trueFalse("same")])[0]?.code).toBe("duplicate_block_id");
    const huge = [questionBlock("trueFalseQuestion", "huge", { prompt: "x".repeat(400_000) })];
    expect(LESSON_DOCUMENT_LIMITS.maxBytes).toBeLessThan(2 * 400_000);
    expect(issuesOf([...huge, ...huge])[0]?.code).toBe("too_large");
  });

  it("points at the block that breaks its schema", () => {
    const wrongChild = questionBlock("singleChoiceQuestion", "s", {
      children: [accepted("a", "One"), choice("b", "Two", true)],
    });

    const [issue] = issuesOf([paragraph("p"), wrongChild]);

    expect(issue?.code).toBe("invalid_content");
    expect(issue?.path.slice(0, 3)).toEqual([1, "children", 0]);
  });

  it.each([
    [
      "unknown props",
      questionBlock("trueFalseQuestion", "t", { props: { answer: true, hint: "x" } }),
    ],
    [
      "points out of range",
      questionBlock("trueFalseQuestion", "t", { props: { answer: true, points: 0 } }),
    ],
    [
      "nested options",
      questionBlock("orderingQuestion", "o", {
        children: [{ ...accepted("a", "x"), type: "quizItem", children: [paragraph("p")] }],
      }),
    ],
    [
      "children on a true or false question",
      questionBlock("trueFalseQuestion", "t", {
        props: { answer: true },
        children: [choice("c", "x")],
      }),
    ],
    ["an unknown block type", { ...paragraph("p"), type: "essayQuestion" }],
  ])("refuses %s", (_label, block) => {
    expect(issuesOf([block])[0]?.code).toBe("invalid_content");
  });

  it("refuses an empty short answer question through the definition schema", () => {
    const issues = issuesOf([questionBlock("shortAnswerQuestion", "a")]);

    expect(issues[0]?.code).toBe("invalid_content");
  });

  it("accepts each question type on its own", () => {
    for (const block of [
      singleChoice(),
      multipleChoice("m", true),
      trueFalse("t", false),
      shortAnswer(),
      ordering(),
      matching(),
    ]) {
      expect(editorDocumentToQuiz([block]).ok).toBe(true);
    }
  });
});

describe("questionProblem", () => {
  it("accepts a true or false question with a prompt", () => {
    const [question] = definitionOf([trueFalse()]).questions;
    if (question === undefined) throw new Error("no question");

    expect(questionProblem(question)).toBeNull();
  });
});

describe("plainText", () => {
  it("joins text and link content with single spaces", () => {
    const content: InlineContent = [
      { type: "text", text: "a\n b", styles: {} },
      {
        type: "link",
        href: "https://example.com",
        content: [{ type: "text", text: " c", styles: {} }],
      },
    ];

    expect(plainText(content)).toBe("a b c");
  });
});

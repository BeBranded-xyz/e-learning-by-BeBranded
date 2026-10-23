import { describe, expect, it } from "vitest";

import { paragraph } from "../../tests/fixtures/lesson-documents.js";
import { accepted, choice, pair, questionBlock } from "../../tests/fixtures/quiz-documents.js";
import { editorDocumentToQuiz } from "./quiz-document.js";

function issuesOf(document: unknown) {
  const result = editorDocumentToQuiz(document);
  if (result.ok) throw new Error("expected issues");
  return result.error;
}

// The rules that make every question answerable and gradable (spec 07).
describe("editorDocumentToQuiz question rules", () => {
  it.each([
    [
      "no prompt",
      questionBlock("trueFalseQuestion", "t", { prompt: "  ", props: { answer: true } }),
      "The question has no prompt",
    ],
    [
      "a single option",
      questionBlock("singleChoiceQuestion", "s", { children: [choice("a", "Only", true)] }),
      "The question needs at least 2 options",
    ],
    [
      "an empty option",
      questionBlock("singleChoiceQuestion", "s", {
        children: [choice("a", "One", true), choice("b", " ")],
      }),
      "Options cannot be empty",
    ],
    [
      "duplicate options",
      questionBlock("multipleChoiceQuestion", "m", {
        props: { partialCredit: false },
        children: [choice("a", "Yes", true), choice("b", "yes")],
      }),
      "Options must be distinct",
    ],
    [
      "no correct option",
      questionBlock("singleChoiceQuestion", "s", {
        children: [choice("a", "One"), choice("b", "Two")],
      }),
      "Tick the correct option",
    ],
    [
      "two correct options on a single choice",
      questionBlock("singleChoiceQuestion", "s", {
        children: [choice("a", "One", true), choice("b", "Two", true)],
      }),
      "A single choice question has exactly one correct option",
    ],
    [
      "no correct option on a multiple choice",
      questionBlock("multipleChoiceQuestion", "m", {
        props: { partialCredit: true },
        children: [choice("a", "One"), choice("b", "Two")],
      }),
      "Tick at least one correct option",
    ],
    [
      "an empty accepted answer",
      questionBlock("shortAnswerQuestion", "sa", { children: [accepted("a", " ")] }),
      "Accepted answers cannot be empty",
    ],
    [
      "a single ordering item",
      questionBlock("orderingQuestion", "o", {
        children: [{ ...accepted("a", "x"), type: "quizItem" }],
      }),
      "The question needs at least 2 options",
    ],
    [
      "a single pair",
      questionBlock("matchingQuestion", "m", { children: [pair("a", "Red", "Fire")] }),
      "A matching question needs at least 2 pairs",
    ],
    [
      "a pair without its match",
      questionBlock("matchingQuestion", "m", {
        children: [pair("a", "Red", "Fire"), pair("b", "Blue", " ")],
      }),
      "Both sides of a pair need a text",
    ],
    [
      "duplicate matches",
      questionBlock("matchingQuestion", "m", {
        children: [pair("a", "Red", "Fire"), pair("b", "Blue", "fire")],
      }),
      "Pairs must be distinct",
    ],
  ])("refuses a question with %s", (_label, block, message) => {
    expect(issuesOf([paragraph("p"), block])).toContainEqual({
      code: "invalid_question",
      message,
      path: [1],
    });
  });

  it("reports every unsound question, not only the first", () => {
    const empty = (id: string) => questionBlock("shortAnswerQuestion", id, { prompt: "" });

    expect(issuesOf([empty("a"), empty("b")]).map((issue) => issue.path)).toEqual([[0], [1]]);
  });
});

import { describe, expect, it } from "vitest";

import { inlineText, questionsOf } from "./questions.js";

const text = (value: string) => [{ type: "text", text: value, styles: {} }];

describe("inlineText", () => {
  it("joins text and link content, trimmed", () => {
    expect(
      inlineText([
        ...text(" Read "),
        { type: "link", href: "https://example.com", content: text("this") },
      ]),
    ).toBe("Read this");
    expect(inlineText(undefined)).toBe("");
    expect(inlineText([null, 3])).toBe("");
  });
});

describe("questionsOf", () => {
  it("reads questions, their props and options, and skips other blocks", () => {
    const document = [
      { id: "p", type: "paragraph", props: {}, content: text("Intro"), children: [] },
      {
        id: "q1",
        type: "multipleChoiceQuestion",
        props: { points: 2, explanation: "Because", partialCredit: true },
        content: text("Pick two"),
        children: [
          {
            id: "o1",
            type: "quizChoice",
            props: { correct: true },
            content: text("A"),
            children: [],
          },
          {
            id: "o2",
            type: "quizChoice",
            props: { correct: false },
            content: text("B"),
            children: [],
          },
        ],
      },
      {
        id: "q2",
        type: "trueFalseQuestion",
        props: { answer: false },
        content: text("Sky is green"),
        children: [],
      },
      {
        id: "q3",
        type: "matchingQuestion",
        props: {},
        content: [],
        children: [
          {
            id: "m1",
            type: "quizPair",
            props: { match: "Paris" },
            content: text("France"),
            children: [],
          },
        ],
      },
    ];

    expect(questionsOf(document)).toEqual([
      {
        id: "q1",
        type: "multipleChoiceQuestion",
        prompt: "Pick two",
        points: 2,
        explanation: "Because",
        answer: null,
        partialCredit: true,
        options: [
          { id: "o1", text: "A", correct: true, match: null },
          { id: "o2", text: "B", correct: false, match: null },
        ],
      },
      expect.objectContaining({ id: "q2", answer: false, partialCredit: null, options: [] }),
      expect.objectContaining({
        id: "q3",
        points: 1,
        explanation: "",
        options: [{ id: "m1", text: "France", correct: null, match: "Paris" }],
      }),
    ]);
  });
});

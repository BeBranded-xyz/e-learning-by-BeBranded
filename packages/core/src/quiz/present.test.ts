import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { fullQuizDocument } from "../../tests/fixtures/quiz-documents.js";
import { presentQuiz } from "./present.js";
import { editorDocumentToQuiz } from "./quiz-document.js";

const result = editorDocumentToQuiz(fullQuizDocument);
if (!result.ok) throw new Error("invalid fixture");
const definition = result.value;
const plain = { seed: 1, shuffleQuestions: false, shuffleOptions: false };

describe("presentQuiz", () => {
  it("names questions q1, q2… in the order shown, with opaque option values", () => {
    const presentation = presentQuiz(definition, plain);

    expect(presentation.questions.map((q) => q.name)).toEqual(["q1", "q2", "q3", "q4", "q5", "q6"]);
    expect(presentation.questions[0]?.options).toEqual([
      { value: "o1", text: "Water", id: "single-a" },
      { value: "o2", text: "CO2", id: "single-b" },
      { value: "o3", text: "Foam", id: "single-c" },
    ]);
    expect(presentation.questions[2]?.options).toEqual([]);
    expect(presentation.outro).toEqual(definition.outro);
  });

  it("keeps the authored order of questions and choices when shuffling is off", () => {
    const presentation = presentQuiz(definition, plain);

    expect(presentation.questions.map((q) => q.question.id)).toEqual(
      definition.questions.map((q) => q.id),
    );
    expect(presentation.questions[1]?.options.map((o) => o.id)).toEqual([
      "multiple-a",
      "multiple-b",
      "multiple-c",
      "multiple-d",
    ]);
  });

  it("always shuffles ordering items, and never into the correct order", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const ordering = presentQuiz(definition, { ...plain, seed }).questions[4];
        expect(ordering?.options.map((o) => o.id)).not.toEqual([
          "ordering-a",
          "ordering-b",
          "ordering-c",
        ]);
      }),
    );
  });

  it("never lines matching columns up with their rows", () => {
    fc.assert(
      fc.property(fc.integer(), fc.boolean(), (seed, shuffleOptions) => {
        const matching = presentQuiz(definition, { ...plain, seed, shuffleOptions }).questions[5];
        expect(matching?.columns.map((c) => c.id)).not.toEqual(matching?.rows.map((r) => r.id));
        expect(matching?.rows.map((r) => r.value)).toEqual(["r1", "r2", "r3"]);
        expect(matching?.columns.map((c) => c.value)).toEqual(["c1", "c2", "c3"]);
      }),
    );
  });

  it("shuffles questions with their intro blocks, and options, when asked", () => {
    const shuffled = presentQuiz(definition, {
      seed: 3,
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    const matching = shuffled.questions.find((q) => q.question.kind === "matching");

    expect(shuffled.questions.map((q) => q.question.id)).not.toEqual(
      definition.questions.map((q) => q.id),
    );
    expect(matching?.question.intro).toEqual(definition.questions[5]?.intro);
  });

  it("rebuilds the same presentation from the same seed", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const options = { seed, shuffleQuestions: true, shuffleOptions: true };
        expect(presentQuiz(definition, options)).toEqual(presentQuiz(definition, options));
      }),
    );
  });
});

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { fullQuizDocument, trueFalse } from "../../tests/fixtures/quiz-documents.js";
import { gradeQuiz } from "./grade.js";
import { presentQuiz } from "./present.js";
import { editorDocumentToQuiz } from "./quiz-document.js";
import { buildCorrections, toSurveyJson } from "./survey.js";

function definitionOf(document: unknown) {
  const result = editorDocumentToQuiz(document);
  if (!result.ok) throw new Error("invalid fixture");
  return result.value;
}

const definition = definitionOf(fullQuizDocument);
const plain = { seed: 9, shuffleQuestions: false, shuffleOptions: false };
const render = (blocks: readonly { id: string }[]) => `<p>${blocks.map((b) => b.id).join(",")}</p>`;

describe("toSurveyJson", () => {
  it("maps each question type to its SurveyJS element, with intro and outro as HTML", () => {
    const survey = toSurveyJson(presentQuiz(definition, plain), render);
    const elements = survey.pages[0].elements;

    expect(elements.map((element) => `${element.type}:${element.name}`)).toEqual([
      "html:q1_intro",
      "radiogroup:q1",
      "checkbox:q2",
      "boolean:q3",
      "text:q4",
      "ranking:q5",
      "html:q6_intro",
      "matrix:q6",
      "html:outro",
    ]);
    expect(elements[0]).toEqual({ type: "html", name: "q1_intro", html: "<p>intro</p>" });
    expect(elements[1]).toEqual({
      type: "radiogroup",
      name: "q1",
      title: "Which extinguisher suits an electrical fire?",
      choices: [
        { value: "o1", text: "Water" },
        { value: "o2", text: "CO2" },
        { value: "o3", text: "Foam" },
      ],
    });
    expect(elements[4]).toEqual({
      type: "text",
      name: "q4",
      title: "Prompt of short",
      maxLength: 500,
    });
  });

  it("adds no HTML element when there are no context blocks", () => {
    const survey = toSurveyJson(presentQuiz(definitionOf([trueFalse()]), plain), render);

    expect(survey.pages[0].elements).toEqual([
      { type: "boolean", name: "q1", title: "Prompt of truefalse" },
    ]);
  });

  it("never contains an answer, an explanation, points or a definition id", () => {
    fc.assert(
      fc.property(fc.integer(), fc.boolean(), fc.boolean(), (seed, questions, options) => {
        const view = presentQuiz(definition, {
          seed,
          shuffleQuestions: questions,
          shuffleOptions: options,
        });
        const json = JSON.stringify(toSurveyJson(view, () => ""));
        for (const forbidden of [
          "correct",
          "answer",
          "explanation",
          "points",
          "CO2 does not conduct",
          "Assembly point",
          "Muster point",
          "single-",
          "multiple-",
          "ordering-",
          "matching-",
        ]) {
          expect(json).not.toContain(forbidden);
        }
      }),
    );
  });
});

describe("buildCorrections", () => {
  it("gives each question's answer in the attempt's values, with its explanation", () => {
    const view = presentQuiz(definition, plain);
    const grade = gradeQuiz(view, { q1: "o1", q3: true });

    const corrections = buildCorrections(view, grade.questions);

    expect(corrections[0]).toEqual({
      name: "q1",
      correct: false,
      earned: 0,
      possible: 1,
      correctAnswer: "o2",
      explanation: "CO2 does not conduct electricity.",
    });
    expect(corrections[1]?.correctAnswer).toEqual(["o1", "o2", "o4"]);
    expect(corrections[2]).toMatchObject({ correct: true, earned: 1, correctAnswer: true });
    expect(corrections[3]?.correctAnswer).toBe("Assembly point");
    expect(corrections[4]?.correctAnswer).toHaveLength(3);
    expect(Object.keys(corrections[5]?.correctAnswer ?? {})).toEqual(["r1", "r2", "r3"]);
  });
});

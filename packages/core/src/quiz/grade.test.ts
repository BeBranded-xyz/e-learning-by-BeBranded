import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { fullQuizDocument, multipleChoice } from "../../tests/fixtures/quiz-documents.js";
import { gradeQuiz, isPassing, normalizeAnswer } from "./grade.js";
import { presentQuiz } from "./present.js";
import type { QuizPresentation } from "./present.js";
import { editorDocumentToQuiz } from "./quiz-document.js";
import type { QuizAnswers } from "./quiz.schemas.js";
import { buildCorrections } from "./survey.js";

function definitionOf(document: unknown) {
  const result = editorDocumentToQuiz(document);
  if (!result.ok) throw new Error("invalid fixture");
  return result.value;
}

const definition = definitionOf(fullQuizDocument);
const plain = { seed: 5, shuffleQuestions: false, shuffleOptions: false };
const presentation = presentQuiz(definition, plain);

/** The values the attempt shows for definition ids, in the order given. */
function valuesOf(name: string, ids: readonly string[], side: "options" | "columns" = "options") {
  const question = presentation.questions.find((q) => q.name === name);
  return ids.map((id) => question?.[side].find((o) => o.id === id)?.value ?? "");
}

const allCorrect = (view: QuizPresentation): QuizAnswers =>
  Object.fromEntries(
    buildCorrections(view, []).map((correction) => [correction.name, correction.correctAnswer]),
  );

const earnedOn = (answers: QuizAnswers, name: string) =>
  gradeQuiz(presentation, answers).questions.find((q) => q.name === name)?.earned;

describe("gradeQuiz", () => {
  it("gives full marks to the correct answers", () => {
    const grade = gradeQuiz(presentation, allCorrect(presentation));

    expect(grade).toMatchObject({ pointsEarned: 9, pointsPossible: 9, score: 1 });
    expect(grade.questions[0]).toEqual({
      questionId: "single",
      name: "q1",
      earned: 1,
      possible: 1,
    });
  });

  it("gives nothing to an empty submission", () => {
    expect(gradeQuiz(presentation, {})).toMatchObject({ pointsEarned: 0, score: 0 });
  });

  it("grades a single choice on the chosen value", () => {
    expect(earnedOn({ q1: "o2" }, "q1")).toBe(1);
    expect(earnedOn({ q1: "o1" }, "q1")).toBe(0);
    expect(earnedOn({ q1: "o9" }, "q1")).toBe(0);
    expect(earnedOn({ q1: true }, "q1")).toBe(0);
  });

  it("grades a multiple choice all or nothing by default", () => {
    expect(earnedOn({ q2: ["o1", "o2", "o4"] }, "q2")).toBe(2);
    expect(earnedOn({ q2: ["o4", "o2", "o1", "o1"] }, "q2")).toBe(2);
    expect(earnedOn({ q2: ["o1", "o2"] }, "q2")).toBe(0);
    expect(earnedOn({ q2: ["o1", "o2", "o3", "o4"] }, "q2")).toBe(0);
    expect(earnedOn({ q2: "o1" }, "q2")).toBe(0);
  });

  it("gives partial credit as correct ticks minus wrong ticks, floored at 0", () => {
    const partial = presentQuiz(definitionOf([multipleChoice("m", true)]), plain);
    const score = (answer: string[]) => gradeQuiz(partial, { q1: answer }).questions[0]?.earned;

    expect(score(["o1", "o2", "o4"])).toBe(2);
    expect(score(["o1", "o2"])).toBe(1.333333);
    expect(score(["o1", "o3"])).toBe(0);
    expect(score(["o3"])).toBe(0);
    expect(score(["o1", "o9"])).toBe(0.666667);
  });

  it("grades a true or false question", () => {
    expect(earnedOn({ q3: true }, "q3")).toBe(1);
    expect(earnedOn({ q3: false }, "q3")).toBe(0);
    expect(earnedOn({ q3: "true" }, "q3")).toBe(0);
  });

  it("compares short answers without case, accents or extra spaces", () => {
    expect(earnedOn({ q4: "  ASSEMBLY   point " }, "q4")).toBe(1);
    expect(earnedOn({ q4: "Mustér point" }, "q4")).toBe(1);
    expect(earnedOn({ q4: "Assembly" }, "q4")).toBe(0);
    expect(earnedOn({ q4: ["Assembly point"] }, "q4")).toBe(0);
  });

  it("grades an ordering all or nothing", () => {
    const correct = valuesOf("q5", ["ordering-a", "ordering-b", "ordering-c"]);

    expect(earnedOn({ q5: correct }, "q5")).toBe(1);
    expect(earnedOn({ q5: [...correct].reverse() }, "q5")).toBe(0);
    expect(earnedOn({ q5: correct.slice(0, 2) }, "q5")).toBe(0);
    expect(earnedOn({ q5: [...correct, "o1"] }, "q5")).toBe(0);
  });

  it("grades a matching per row", () => {
    const [fire, mandatory, safe] = valuesOf(
      "q6",
      ["matching-a", "matching-b", "matching-c"],
      "columns",
    );

    expect(earnedOn({ q6: { r1: fire ?? "", r2: mandatory ?? "", r3: safe ?? "" } }, "q6")).toBe(3);
    expect(earnedOn({ q6: { r1: fire ?? "", r2: safe ?? "" } }, "q6")).toBe(1);
    expect(earnedOn({ q6: { r9: fire ?? "" } }, "q6")).toBe(0);
    expect(earnedOn({ q6: ["c1"] }, "q6")).toBe(0);
  });

  it("weighs questions by their points", () => {
    expect(gradeQuiz(presentation, { q6: allCorrect(presentation).q6 ?? {} }).score).toBe(0.333333);
  });

  it("gives full marks to the correct answers of any shuffled attempt", () => {
    fc.assert(
      fc.property(fc.integer(), fc.boolean(), fc.boolean(), (seed, questions, options) => {
        const view = presentQuiz(definition, {
          seed,
          shuffleQuestions: questions,
          shuffleOptions: options,
        });
        expect(gradeQuiz(view, allCorrect(view)).score).toBe(1);
      }),
    );
  });

  it("keeps every score between 0 and 1, whatever is posted", () => {
    const answer = fc.oneof(
      fc.string(),
      fc.boolean(),
      fc.array(fc.constantFrom("o1", "o2", "o3", "o4", "o5")),
      fc.dictionary(fc.constantFrom("r1", "r2", "r3"), fc.constantFrom("c1", "c2", "c3")),
    );
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom("q1", "q2", "q3", "q4", "q5", "q6"), answer),
        (answers) => {
          const grade = gradeQuiz(presentation, answers);
          expect(grade.score).toBeGreaterThanOrEqual(0);
          expect(grade.score).toBeLessThanOrEqual(1);
          for (const question of grade.questions) {
            expect(question.earned).toBeLessThanOrEqual(question.possible);
          }
        },
      ),
    );
  });
});

describe("normalizeAnswer", () => {
  it("removes case, accents and repeated whitespace", () => {
    expect(normalizeAnswer("  Élève\tÇA  va ")).toBe("eleve ca va");
  });
});

describe("isPassing", () => {
  it("passes at the threshold and above, fails below", () => {
    expect(isPassing(0.8, 0.8)).toBe(true);
    expect(isPassing(0.9, 0.8)).toBe(true);
    expect(isPassing(0.79, 0.8)).toBe(false);
    expect(isPassing(0.1 + 0.2, 0.3)).toBe(true);
    expect(isPassing(0, 0)).toBe(true);
  });
});

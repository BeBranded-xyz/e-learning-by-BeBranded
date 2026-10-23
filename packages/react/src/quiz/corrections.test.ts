import { describe, expect, it } from "vitest";

import type { ApiQuizCorrection, SurveyJson } from "@bebranded/elearning-core";

import { correctionViews } from "./corrections.js";

const survey: SurveyJson = {
  pages: [
    {
      name: "quiz",
      elements: [
        {
          type: "checkbox",
          name: "q1",
          title: "Protection",
          choices: [
            { value: "o1", text: "Gloves" },
            { value: "o2", text: "Mask" },
          ],
        },
        {
          type: "ranking",
          name: "q2",
          title: "Order",
          choices: [
            { value: "o1", text: "Evacuate" },
            { value: "o2", text: "Alarm" },
          ],
        },
        { type: "text", name: "q3", title: "Place", maxLength: 500 },
        {
          type: "matrix",
          name: "q4",
          title: "Colors",
          rows: [
            { value: "r1", text: "Red" },
            { value: "r2", text: "Green" },
          ],
          columns: [
            { value: "c1", text: "Safe" },
            { value: "c2", text: "Fire" },
          ],
        },
        { type: "boolean", name: "q5", title: "Lifts are safe" },
      ],
    },
  ],
};

const correction = (
  name: string,
  answer: ApiQuizCorrection["correct_answer"],
): ApiQuizCorrection => ({
  name,
  correct: false,
  earned: 0,
  possible: 1,
  correct_answer: answer,
  explanation: "",
});

const labels = { yes: "True", no: "False" };

describe("correctionViews", () => {
  it("puts every kind of answer into words", () => {
    const views = correctionViews(
      survey,
      [
        correction("q1", ["o1", "o2"]),
        correction("q2", ["o2", "o1"]),
        correction("q3", "Assembly point"),
        correction("q4", { r1: "c2", r2: "c1" }),
        correction("q5", false),
      ],
      labels,
    );

    expect(views.map((view) => [view.title, view.answer])).toEqual([
      ["Protection", "Gloves, Mask"],
      ["Order", "Alarm, Evacuate"],
      ["Place", "Assembly point"],
      ["Colors", "Red → Fire, Green → Safe"],
      ["Lifts are safe", "False"],
    ]);
  });

  it("falls back to the raw value or name when the survey does not know it", () => {
    const [unknown, missingRow] = correctionViews(
      survey,
      [correction("q9", "o1"), correction("q4", { r1: "c9" })],
      labels,
    );

    expect(unknown).toMatchObject({ title: "q9", answer: "o1" });
    expect(missingRow?.answer).toBe("Red → c9, Green → ");
  });
});

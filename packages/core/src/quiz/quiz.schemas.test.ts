import { describe, expect, it } from "vitest";

import { QUIZ_LIMITS, quizAnswersSchema, quizLessonSettingsSchema } from "./quiz.schemas.js";

describe("quizLessonSettingsSchema", () => {
  it("fills the defaults", () => {
    expect(quizLessonSettingsSchema.parse({})).toEqual({
      passingScore: 0.8,
      maxAttempts: null,
      cooldownMinutes: 0,
      timeLimitMinutes: null,
      shuffleQuestions: false,
      shuffleOptions: false,
      showCorrection: "after_pass",
    });
  });

  it.each([
    { passingScore: 1.2 },
    { passingScore: -0.1 },
    { maxAttempts: 0 },
    { maxAttempts: 1.5 },
    { cooldownMinutes: -1 },
    { timeLimitMinutes: 0 },
    { showCorrection: "always" },
    { unknown: true },
  ])("refuses %o", (settings) => {
    expect(quizLessonSettingsSchema.safeParse(settings).success).toBe(false);
  });
});

describe("quizAnswersSchema", () => {
  it("accepts the shapes SurveyJS produces", () => {
    const answers = { q1: "o2", q2: ["o1", "o3"], q3: false, q4: "free text", q6: { r1: "c2" } };

    expect(quizAnswersSchema.parse(answers)).toEqual(answers);
  });

  it.each([
    [{ question1: "o1" }],
    [{ q0: "o1" }],
    [{ q1: ["not a value"] }],
    [{ q1: { r1: "not a value" } }],
    [{ q1: 3 }],
    [{ q1: "x".repeat(QUIZ_LIMITS.maxShortAnswerLength + 1) }],
    [{ q1: Array.from({ length: QUIZ_LIMITS.maxOptions + 1 }, () => "o1") }],
  ])("refuses %o", (answers) => {
    expect(quizAnswersSchema.safeParse(answers).success).toBe(false);
  });

  it("refuses more answers than questions a quiz can have", () => {
    const answers = Object.fromEntries(
      Array.from({ length: QUIZ_LIMITS.maxQuestions + 1 }, (_, index) => [`q${index + 1}`, true]),
    );

    expect(quizAnswersSchema.safeParse(answers).success).toBe(false);
  });
});

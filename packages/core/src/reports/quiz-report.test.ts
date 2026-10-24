import { describe, expect, it } from "vitest";

import {
  learnerIdSchema,
  lessonIdSchema,
  quizAttemptIdSchema,
  quizIdSchema,
} from "../content/ids.js";
import type { QuizAttempt, QuizAttemptStatus } from "../ports/quiz-storage.types.js";
import type { QuizDefinition } from "../quiz/quiz.schemas.js";
import { summarizeQuizAttempts } from "./quiz-report.js";

const definition = {
  questions: [
    {
      id: "q-a",
      kind: "true_false",
      prompt: "A?",
      points: 1,
      explanation: "",
      intro: [],
      answer: true,
    },
    {
      id: "q-b",
      kind: "true_false",
      prompt: "B?",
      points: 2,
      explanation: "",
      intro: [],
      answer: false,
    },
  ],
  outro: [],
} as const satisfies QuizDefinition;

let counter = 0;

type AttemptInput = {
  status?: QuizAttemptStatus;
  score?: number | null;
  results?: [earnedA: number, earnedB: number] | null;
  closedAt?: string;
};

function anAttempt(learner: string, input: AttemptInput = {}): QuizAttempt {
  const { status = "submitted", score = null, results = null } = input;
  const closedAt = input.closedAt ?? "2026-10-20T10:00:00Z";
  counter += 1;
  return {
    id: quizAttemptIdSchema.parse(`00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`),
    quizId: quizIdSchema.parse("11111111-1111-4111-8111-111111111111"),
    lessonId: lessonIdSchema.parse("22222222-2222-4222-8222-222222222222"),
    learnerId: learnerIdSchema.parse(learner),
    attemptNumber: counter,
    status,
    quizVersion: "a".repeat(64),
    seed: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    startedAt: new Date("2026-10-20T09:00:00Z"),
    expiresAt: null,
    closedAt: new Date(closedAt),
    answers: {},
    questionResults:
      results === null
        ? null
        : [
            { questionId: "q-a", name: "q1", earned: results[0], possible: 1 },
            { questionId: "q-b", name: "q2", earned: results[1], possible: 2 },
          ],
    score,
    passed: score === null ? null : score >= 0.7,
  };
}

describe("summarizeQuizAttempts", () => {
  it("summarizes learners, pass rate, scores, attempts and questions", () => {
    const report = summarizeQuizAttempts(
      [
        anAttempt("ann", {
          status: "submitted",
          score: 1 / 3,
          results: [1, 0],
          closedAt: "2026-10-20T10:00:00Z",
        }),
        anAttempt("ann", {
          status: "submitted",
          score: 1,
          results: [1, 2],
          closedAt: "2026-10-21T10:00:00Z",
        }),
        anAttempt("bob", { status: "expired", score: 0, results: [0, 0] }),
      ],
      definition,
    );

    expect(report).toMatchObject({
      learners: 2,
      attempts: 3,
      passRate: 0.5,
      averageScore: 0.444444,
      averageAttempts: 1.5,
    });
    expect(report.perLearner).toEqual([
      {
        learnerId: "ann",
        attempts: 2,
        bestScore: 1,
        passed: true,
        lastAttemptAt: new Date("2026-10-21T10:00:00Z"),
      },
      {
        learnerId: "bob",
        attempts: 1,
        bestScore: 0,
        passed: false,
        lastAttemptAt: new Date("2026-10-20T10:00:00Z"),
      },
    ]);
    expect(report.questions).toEqual([
      { questionId: "q-a", prompt: "A?", answered: 3, correctRate: 0.666667 },
      { questionId: "q-b", prompt: "B?", answered: 3, correctRate: 0.333333 },
    ]);
  });

  it("keeps the latest attempt date whatever the order", () => {
    const report = summarizeQuizAttempts(
      [
        anAttempt("ann", {
          status: "submitted",
          score: 1,
          results: [1, 2],
          closedAt: "2026-10-22T10:00:00Z",
        }),
        anAttempt("ann", {
          status: "submitted",
          score: 0,
          results: [0, 0],
          closedAt: "2026-10-20T10:00:00Z",
        }),
      ],
      definition,
    );

    expect(report.perLearner[0]?.lastAttemptAt).toEqual(new Date("2026-10-22T10:00:00Z"));
    expect(report.perLearner[0]?.bestScore).toBe(1);
  });

  it.each<QuizAttemptStatus>(["open", "voided"])("ignores %s attempts", (status) => {
    const report = summarizeQuizAttempts([anAttempt("ann", { status })], definition);

    expect(report).toMatchObject({ learners: 0, attempts: 0, passRate: null, averageScore: null });
  });

  it("ignores results of questions that are no longer in the quiz", () => {
    const attempt = anAttempt("ann", { status: "submitted", score: 1, results: null });
    const report = summarizeQuizAttempts(
      [
        {
          ...attempt,
          questionResults: [{ questionId: "gone", name: "q1", earned: 1, possible: 1 }],
        },
      ],
      definition,
    );

    expect(report.questions).toEqual([
      { questionId: "q-a", prompt: "A?", answered: 0, correctRate: null },
      { questionId: "q-b", prompt: "B?", answered: 0, correctRate: null },
    ]);
  });

  it("answers an empty report without attempts", () => {
    expect(summarizeQuizAttempts([], definition)).toEqual({
      learners: 0,
      attempts: 0,
      passRate: null,
      averageScore: null,
      averageAttempts: null,
      perLearner: [],
      questions: [
        { questionId: "q-a", prompt: "A?", answered: 0, correctRate: null },
        { questionId: "q-b", prompt: "B?", answered: 0, correctRate: null },
      ],
    });
  });
});

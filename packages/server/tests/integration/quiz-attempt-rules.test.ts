import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Chapter, JsonValue, LessonDetail } from "@bebranded/elearning-core";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { quizDocument, rightAnswers, wrongAnswers } from "../support/quiz.js";
import type { Survey } from "../support/quiz.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

const scope = { tenantId: tenant, includeShared: false };
const MINUTE = 60_000;
let t: TestApp;
let chapter: Chapter;

async function saveQuiz(lesson: LessonDetail, prompt?: string) {
  const saved = await t.request("PUT", `/v1/admin/lessons/${lesson.id}/quiz`, {
    as: "admin",
    body: { document: quizDocument(prompt) },
  });
  expect(saved.status).toBe(200);
}

async function aQuizLesson(settings: Record<string, JsonValue>) {
  const lesson = aLesson(chapter, { type: "quiz", content: null, settings });
  await t.database.storage.transaction((tx) => tx.insertLesson(scope, lesson));
  await saveQuiz(lesson);
  return lesson;
}

async function open(lesson: LessonDetail) {
  const response = await t.request("POST", `/v1/lessons/${lesson.id}/quiz/attempts`, {
    as: "staff",
  });
  const body = await readJson(response);
  return { response, body, id: String(body.id), survey: body.survey as Survey };
}

async function submit(lesson: LessonDetail, attemptId: string, answers: unknown) {
  const response = await t.request(
    "POST",
    `/v1/lessons/${lesson.id}/quiz/attempts/${attemptId}/submit`,
    { as: "staff", body: { answers } },
  );
  return { response, body: await readJson(response) };
}

async function lessonQuiz(lesson: LessonDetail) {
  const body = await readJson(await t.request("GET", `/v1/lessons/${lesson.id}`, { as: "staff" }));
  return body.quiz as Record<string, unknown>;
}

beforeAll(async () => {
  t = await createTestApp();
  const course = aCourse(tenant, { slug: "quiz-rules" });
  chapter = aChapter(course);
  await seed(t.database, [
    { course, chapters: [chapter], rules: [rule(course, "course", "allow")] },
  ]);
});

afterAll(async () => {
  await t.database.drop();
});

describe("attempt limits and cooldown", () => {
  it("refuses an attempt beyond the limit", async () => {
    const lesson = await aQuizLesson({ maxAttempts: 2 });
    for (let index = 0; index < 2; index += 1) {
      const attempt = await open(lesson);
      await submit(lesson, attempt.id, wrongAnswers(attempt.survey));
    }

    const refused = await open(lesson);

    expect(refused.response.status).toBe(409);
    expect(refused.body.error).toMatchObject({ code: "attempts_exhausted" });
    expect(await lessonQuiz(lesson)).toMatchObject({ attempts_used: 2, attempts_remaining: 0 });
  });

  it("makes the learner wait for the cooldown, with Retry-After", async () => {
    const lesson = await aQuizLesson({ cooldownMinutes: 10 });
    const attempt = await open(lesson);
    const result = await submit(lesson, attempt.id, wrongAnswers(attempt.survey));
    t.advance(4 * MINUTE);

    const early = await open(lesson);

    expect(result.body.next_attempt_at).toEqual(expect.any(String));
    expect(early.response.status).toBe(429);
    expect(early.response.headers.get("retry-after")).toBe("360");
    expect(early.body.error).toMatchObject({
      code: "cooldown",
      details: { next_attempt_at: result.body.next_attempt_at, retry_after_seconds: 360 },
    });
    t.advance(6 * MINUTE);
    expect((await open(lesson)).response.status).toBe(201);
  });
});

describe("time limit", () => {
  it("expires a late submission with a score of 0", async () => {
    const lesson = await aQuizLesson({ timeLimitMinutes: 1 });
    const attempt = await open(lesson);
    t.advance(2 * MINUTE);

    const { body } = await submit(lesson, attempt.id, rightAnswers(attempt.survey));

    expect(attempt.body.expires_at).toEqual(expect.any(String));
    expect(body).toMatchObject({ outcome: "expired", score: 0, passed: false, points_possible: 2 });
  });

  it("accepts a submission within 30 seconds of the deadline", async () => {
    const lesson = await aQuizLesson({ timeLimitMinutes: 1 });
    const attempt = await open(lesson);
    t.advance(MINUTE + 25_000);

    const { body } = await submit(lesson, attempt.id, rightAnswers(attempt.survey));

    expect(body).toMatchObject({ outcome: "graded", passed: true });
  });

  it("closes an abandoned attempt at its deadline when the next one opens", async () => {
    const lesson = await aQuizLesson({ timeLimitMinutes: 1 });
    const abandoned = await open(lesson);
    expect((await lessonQuiz(lesson)).open_attempt).toMatchObject({ id: abandoned.id });
    t.advance(10 * MINUTE);

    expect((await lessonQuiz(lesson)).open_attempt).toBeNull();
    const next = await open(lesson);

    expect(next.response.status).toBe(201);
    expect(next.body.attempt_number).toBe(2);
    expect(await lessonQuiz(lesson)).toMatchObject({ attempts_used: 1, best_score: 0 });
  });
});

describe("editing a quiz while an attempt is open", () => {
  it("voids the attempt, which does not count", async () => {
    const lesson = await aQuizLesson({ maxAttempts: 1 });
    const attempt = await open(lesson);
    await saveQuiz(lesson, "Edited: exit signs are green.");

    const refused = await submit(lesson, attempt.id, rightAnswers(attempt.survey));
    const retried = await submit(lesson, attempt.id, rightAnswers(attempt.survey));
    const next = await open(lesson);

    expect(refused.response.status).toBe(409);
    expect(refused.body.error).toMatchObject({ code: "quiz_changed" });
    expect(retried.response.status).toBe(409);
    expect(next.body.attempt_number).toBe(1);
    expect(JSON.stringify(next.survey)).toContain("Edited: exit signs are green.");
  });

  it("voids an open attempt of the old version when the next one opens", async () => {
    const lesson = await aQuizLesson({});
    const before = await open(lesson);
    await saveQuiz(lesson, "Second version.");

    const after = await open(lesson);

    expect(after.response.status).toBe(201);
    expect(after.id).not.toBe(before.id);
  });
});

describe("corrections and shuffling", () => {
  it("shows corrections after every attempt with after_attempt, never with never", async () => {
    const every = await aQuizLesson({ showCorrection: "after_attempt" });
    const never = await aQuizLesson({ showCorrection: "never" });
    const failed = await open(every);
    const passed = await open(never);

    const shown = await submit(every, failed.id, wrongAnswers(failed.survey));
    const hidden = await submit(never, passed.id, rightAnswers(passed.survey));

    expect(shown.body.corrections).toEqual([
      expect.objectContaining({ name: "q1", correct: false, correct_answer: true }),
      expect.objectContaining({ name: "q2", correct: false }),
    ]);
    expect(hidden.body).toMatchObject({ passed: true, corrections: null });
  });

  it("grades a shuffled attempt by what the learner saw, even if shuffling is turned off meanwhile", async () => {
    const lesson = await aQuizLesson({ shuffleQuestions: true, shuffleOptions: true });
    const attempt = await open(lesson);
    const patched = await t.request("PATCH", `/v1/admin/lessons/${lesson.id}`, {
      as: "admin",
      body: { settings: { shuffleQuestions: false, shuffleOptions: false } },
    });
    expect(patched.status).toBe(200);

    const { body } = await submit(lesson, attempt.id, rightAnswers(attempt.survey));

    expect(body).toMatchObject({ score: 1, passed: true });
  });
});

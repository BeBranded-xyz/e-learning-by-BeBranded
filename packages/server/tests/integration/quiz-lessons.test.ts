import { randomUUID } from "node:crypto";

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Chapter, JsonValue, LessonDetail } from "@bebranded/elearning-core";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { quizDocument, rightAnswers, wrongAnswers } from "../support/quiz.js";
import type { Survey } from "../support/quiz.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { LearnerName, TestApp } from "../support/test-app.js";

const scope = { tenantId: tenant, includeShared: false };
let t: TestApp;
let chapter: Chapter;
let textLesson: LessonDetail;

/** A published quiz lesson with the two-question quiz, saved through the admin API. */
async function aQuizLesson(settings: Record<string, JsonValue> = {}, withQuiz = true) {
  const lesson = aLesson(chapter, { type: "quiz", content: null, settings });
  await t.database.storage.transaction((tx) => tx.insertLesson(scope, lesson));
  if (withQuiz) {
    const saved = await t.request("PUT", `/v1/admin/lessons/${lesson.id}/quiz`, {
      as: "admin",
      body: { document: quizDocument() },
    });
    expect(saved.status).toBe(200);
  }
  return lesson;
}

async function open(lesson: LessonDetail, as: LearnerName = "staff") {
  const response = await t.request("POST", `/v1/lessons/${lesson.id}/quiz/attempts`, { as });
  return { response, body: await readJson(response) };
}

async function openOk(lesson: LessonDetail, as: LearnerName = "staff") {
  const { response, body } = await open(lesson, as);
  expect(response.status).toBeLessThan(300);
  return { id: String(body.id), survey: body.survey as Survey, body };
}

async function submit(
  lesson: LessonDetail,
  attemptId: string,
  answers: unknown,
  as: LearnerName = "staff",
) {
  const response = await t.request(
    "POST",
    `/v1/lessons/${lesson.id}/quiz/attempts/${attemptId}/submit`,
    { as, body: { answers } },
  );
  return { response, body: await readJson(response) };
}

async function quizEvents(lesson: LessonDetail) {
  const rows = await sql<{ payload: { lessonId: string; passed: boolean } }>`
    SELECT payload FROM ${sql.id(t.database.schema, "event_outbox")}
    WHERE type = 'quiz.attempt_submitted' ORDER BY created_at`.execute(t.database.admin);
  return rows.rows.filter((row) => row.payload.lessonId === lesson.id);
}

beforeAll(async () => {
  t = await createTestApp();
  const course = aCourse(tenant, { slug: "quiz-course" });
  chapter = aChapter(course);
  textLesson = aLesson(chapter, { position: 9 });
  await seed(t.database, [
    {
      course,
      chapters: [chapter],
      lessons: [textLesson],
      rules: [rule(course, "course", "allow")],
    },
  ]);
});

afterAll(async () => {
  await t.database.drop();
});

describe("GET /v1/lessons/:id for a quiz lesson", () => {
  it("gives the rules and the learner's standing, never a question or an answer", async () => {
    const lesson = await aQuizLesson();

    const response = await t.request("GET", `/v1/lessons/${lesson.id}`, { as: "staff" });
    const body = await readJson(response);

    expect(body.quiz).toEqual({
      ready: true,
      question_count: 2,
      passing_score: 0.8,
      max_attempts: null,
      attempts_used: 0,
      attempts_remaining: null,
      cooldown_minutes: 0,
      next_attempt_at: null,
      time_limit_minutes: null,
      best_score: null,
      passed: false,
      show_correction: "after_pass",
      open_attempt: null,
    });
    const raw = JSON.stringify(body);
    for (const leak of [
      "Exit signs",
      "Green",
      "correctOption",
      "correct_answer",
      "explanation",
      "color-",
    ]) {
      expect(raw).not.toContain(leak);
    }
  });

  it("says when the quiz has no questions yet, and has no quiz block for other lessons", async () => {
    const lesson = await aQuizLesson({}, false);

    const quiz = await readJson(
      await t.request("GET", `/v1/lessons/${lesson.id}`, { as: "staff" }),
    );
    const text = await readJson(
      await t.request("GET", `/v1/lessons/${textLesson.id}`, { as: "staff" }),
    );

    expect(quiz.quiz).toMatchObject({ ready: false, question_count: 0 });
    expect(text.quiz).toBeNull();
  });
});

describe("opening an attempt", () => {
  it("returns a survey without answers, and resumes the same attempt when opened again", async () => {
    const lesson = await aQuizLesson();

    const first = await open(lesson);
    const again = await open(lesson);

    expect(first.response.status).toBe(201);
    expect(again.response.status).toBe(200);
    expect(again.body).toEqual(first.body);
    expect(first.body).toMatchObject({ attempt_number: 1, expires_at: null });
    const survey = JSON.stringify(first.body.survey);
    expect(survey).toContain("Which color marks an emergency exit?");
    expect(survey).toContain("Look at the poster in the hall.");
    for (const leak of ["correct", "explanation", "points", "color-", "Green means"]) {
      expect(survey).not.toContain(leak);
    }
  });

  it("starts the lesson", async () => {
    const lesson = await aQuizLesson();

    await openOk(lesson);

    const body = await readJson(
      await t.request("GET", `/v1/lessons/${lesson.id}`, { as: "staff" }),
    );
    expect(body.status).toBe("in_progress");
  });

  it("opens one attempt when two tabs open at once", async () => {
    const lesson = await aQuizLesson();

    const [a, b] = await Promise.all([open(lesson), open(lesson)]);

    expect([a.response.status, b.response.status].sort()).toEqual([200, 201]);
    expect(a.body.id).toBe(b.body.id);
  });

  it("refuses a lesson without questions and a lesson that is not a quiz", async () => {
    const empty = await aQuizLesson({}, false);

    const notReady = await open(empty);
    const notQuiz = await open(textLesson);

    expect(notReady.response.status).toBe(409);
    expect(notReady.body.error).toMatchObject({ code: "quiz_not_ready" });
    expect(notQuiz.response.status).toBe(409);
    expect(notQuiz.body.error).toMatchObject({ code: "not_a_quiz_lesson" });
  });

  it("hides a lesson the learner cannot access, and refuses anonymous requests", async () => {
    const lesson = await aQuizLesson();
    await t.database.storage.transaction((tx) =>
      tx.insertAccessRule(rule(lesson, "lesson", "deny", { type: "role", role: "staff" })),
    );

    expect((await open(lesson)).response.status).toBe(404);
    expect((await t.request("POST", `/v1/lessons/${lesson.id}/quiz/attempts`)).status).toBe(401);
  });
});

describe("submitting an attempt", () => {
  it("grades on the server, completes the lesson and shows corrections once passed", async () => {
    const lesson = await aQuizLesson();
    const attempt = await openOk(lesson);

    const { response, body } = await submit(lesson, attempt.id, rightAnswers(attempt.survey));

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      attempt_id: attempt.id,
      attempt_number: 1,
      outcome: "graded",
      score: 1,
      passed: true,
      points_earned: 2,
      points_possible: 2,
      status: "completed",
      best_score: 1,
      attempts_remaining: null,
      next_attempt_at: null,
    });
    expect(body.corrections).toEqual([
      expect.objectContaining({ name: "q1", correct: true, correct_answer: true }),
      expect.objectContaining({ name: "q2", correct: true, explanation: "Green means safe." }),
    ]);
    expect(await quizEvents(lesson)).toEqual([
      { payload: expect.objectContaining({ passed: true, score: 1, attemptNumber: 1 }) as unknown },
    ]);
  });

  it("keeps the corrections of a failed attempt hidden by default", async () => {
    const lesson = await aQuizLesson();
    const attempt = await openOk(lesson);

    const { body } = await submit(lesson, attempt.id, wrongAnswers(attempt.survey));

    expect(body).toMatchObject({
      score: 0,
      passed: false,
      status: "in_progress",
      corrections: null,
    });
  });

  it("returns the stored result to a retried submission, without grading it again", async () => {
    const lesson = await aQuizLesson();
    const attempt = await openOk(lesson);
    const first = await submit(lesson, attempt.id, wrongAnswers(attempt.survey));

    const retry = await submit(lesson, attempt.id, rightAnswers(attempt.survey));
    const [a, b] = await Promise.all([
      submit(lesson, attempt.id, rightAnswers(attempt.survey)),
      submit(lesson, attempt.id, rightAnswers(attempt.survey)),
    ]);

    expect(retry.body).toEqual(first.body);
    expect(a.body).toEqual(first.body);
    expect(b.body).toEqual(first.body);
    expect(await quizEvents(lesson)).toHaveLength(1);
  });

  it("gives nothing to forged answers", async () => {
    const lesson = await aQuizLesson();
    const attempt = await openOk(lesson);

    const { body } = await submit(lesson, attempt.id, { q1: false, q2: "o9", q99: true });

    expect(body).toMatchObject({ score: 0, passed: false });
  });

  it("refuses malformed answers", async () => {
    const lesson = await aQuizLesson();
    const attempt = await openOk(lesson);

    const unknownKey = await submit(lesson, attempt.id, { "q1; DROP": true });
    const missing = await t.request(
      "POST",
      `/v1/lessons/${lesson.id}/quiz/attempts/${attempt.id}/submit`,
      {
        as: "staff",
        body: {},
      },
    );

    expect(unknownKey.response.status).toBe(400);
    expect(missing.status).toBe(400);
  });

  it("answers 404 for another learner's attempt, another lesson's attempt or a malformed id", async () => {
    const lesson = await aQuizLesson();
    const other = await aQuizLesson();
    const attempt = await openOk(lesson, "manager");

    expect((await submit(lesson, attempt.id, {})).response.status).toBe(404);
    expect((await submit(other, attempt.id, {}, "manager")).response.status).toBe(404);
    expect((await submit(lesson, randomUUID(), {}, "manager")).response.status).toBe(404);
    expect((await submit(lesson, "not-an-id", {}, "manager")).response.status).toBe(404);
  });
});

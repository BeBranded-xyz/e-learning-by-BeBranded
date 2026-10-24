import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Chapter, JsonValue, LessonDetail } from "@bebranded/elearning-core";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { quizDocument, wrongAnswers } from "../support/quiz.js";
import type { Survey } from "../support/quiz.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

const scope = { tenantId: tenant, includeShared: false };
let t: TestApp;
let chapter: Chapter;

async function aQuizLesson(settings: Record<string, JsonValue>) {
  const lesson = aLesson(chapter, { type: "quiz", content: null, settings });
  await t.database.storage.transaction((tx) => tx.insertLesson(scope, lesson));
  const saved = await t.request("PUT", `/v1/admin/lessons/${lesson.id}/quiz`, {
    as: "admin",
    body: { document: quizDocument() },
  });
  expect(saved.status).toBe(200);
  return lesson;
}

async function useAttempt(lesson: LessonDetail) {
  const opened = await t.request("POST", `/v1/lessons/${lesson.id}/quiz/attempts`, { as: "staff" });
  const body = await readJson(opened);
  if (opened.status >= 400) return opened.status;
  await t.request("POST", `/v1/lessons/${lesson.id}/quiz/attempts/${String(body.id)}/submit`, {
    as: "staff",
    body: { answers: wrongAnswers(body.survey as Survey) },
  });
  return opened.status;
}

function grant(lessonId: string, body: unknown, as: "admin" | "staff" = "admin") {
  return t.request("POST", `/v1/admin/lessons/${lessonId}/quiz/attempt-grants`, { as, body });
}

const staffGrant = (extra: number) => ({ learner_id: "staff-1", extra_attempts: extra });

beforeAll(async () => {
  t = await createTestApp();
  const course = aCourse(tenant, { slug: "quiz-grants" });
  chapter = aChapter(course);
  await seed(t.database, [
    { course, chapters: [chapter], rules: [rule(course, "course", "allow")] },
  ]);
});

afterAll(async () => {
  await t.database.drop();
});

describe("POST /v1/admin/lessons/:id/quiz/attempt-grants", () => {
  it("lets a learner who used every attempt try again", async () => {
    const lesson = await aQuizLesson({ maxAttempts: 1 });
    await useAttempt(lesson);
    expect(await useAttempt(lesson)).toBe(409);

    const response = await grant(lesson.id, staffGrant(2));

    expect(response.status).toBe(201);
    expect(await readJson(response)).toMatchObject({
      lesson_id: lesson.id,
      learner_id: "staff-1",
      extra_attempts: 2,
      granted_by: "admin-1",
      created_at: "2026-06-01T09:00:00.000Z",
      attempts_used: 1,
      attempts_remaining: 2,
    });
    expect(await useAttempt(lesson)).toBe(201);
    expect(await useAttempt(lesson)).toBe(201);
    expect(await useAttempt(lesson)).toBe(409);
  });

  it("shows the granted attempts in the learner's lesson", async () => {
    const lesson = await aQuizLesson({ maxAttempts: 2 });
    await grant(lesson.id, staffGrant(3));

    const body = await readJson(
      await t.request("GET", `/v1/lessons/${lesson.id}`, { as: "staff" }),
    );

    expect(body.quiz).toMatchObject({ attempts_used: 0, attempts_remaining: 5 });
  });

  it("answers null remaining attempts for a quiz without a limit", async () => {
    const lesson = await aQuizLesson({ maxAttempts: null });

    expect(await readJson(await grant(lesson.id, staffGrant(1)))).toMatchObject({
      attempts_remaining: null,
    });
  });

  it("only changes the granted learner's limit", async () => {
    const lesson = await aQuizLesson({ maxAttempts: 1 });
    await grant(lesson.id, { learner_id: "manager-1", extra_attempts: 5 });
    await useAttempt(lesson);

    expect(await useAttempt(lesson)).toBe(409);
  });

  it.each([
    ["zero attempts", { learner_id: "staff-1", extra_attempts: 0 }],
    ["too many attempts", { learner_id: "staff-1", extra_attempts: 101 }],
    ["a fractional count", { learner_id: "staff-1", extra_attempts: 1.5 }],
    ["an empty learner", { learner_id: " ", extra_attempts: 1 }],
    ["an unknown field", { learner_id: "staff-1", extra_attempts: 1, reset: true }],
  ])("refuses %s with 400", async (_label, body) => {
    const lesson = await aQuizLesson({ maxAttempts: 1 });

    expect((await grant(lesson.id, body)).status).toBe(400);
  });

  it("answers 409 not_a_quiz_lesson for a text lesson", async () => {
    const lesson = aLesson(chapter, { type: "text" });
    await t.database.storage.transaction((tx) => tx.insertLesson(scope, lesson));

    const response = await grant(lesson.id, staffGrant(1));

    expect(response.status).toBe(409);
    expect((await readJson(response)).error).toMatchObject({ code: "not_a_quiz_lesson" });
  });

  it.each(["not-a-uuid", "00000000-0000-4000-8000-000000000000"])(
    "answers 404 for the lesson %s",
    async (id) => {
      expect((await grant(id, staffGrant(1))).status).toBe(404);
    },
  );

  it("is admin only", async () => {
    const lesson = await aQuizLesson({ maxAttempts: 1 });

    expect((await grant(lesson.id, staffGrant(1), "staff")).status).toBe(403);
  });
});

describe("GET /v1/admin/lessons/:id/quiz/attempt-grants", () => {
  it("lists every grant oldest first, and one learner's on request", async () => {
    const lesson = await aQuizLesson({ maxAttempts: 1 });
    await grant(lesson.id, staffGrant(1));
    t.advance(60_000);
    await grant(lesson.id, { learner_id: "manager-1", extra_attempts: 2 });
    const list = (query: string) =>
      t
        .request("GET", `/v1/admin/lessons/${lesson.id}/quiz/attempt-grants${query}`, {
          as: "admin",
        })
        .then(readJson);

    const all = await list("");
    const mine = await list("?learner_id=manager-1");
    const malformed = await list(`?learner_id=${" ".repeat(3)}`);

    expect((all.data as { learner_id: string }[]).map((entry) => entry.learner_id)).toEqual([
      "staff-1",
      "manager-1",
    ]);
    expect(mine).toMatchObject({
      data: [{ learner_id: "manager-1", extra_attempts: 2 }],
      next_cursor: null,
    });
    expect(malformed.data).toEqual([]);
  });
});

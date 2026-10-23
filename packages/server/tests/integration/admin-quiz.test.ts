import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { quizDocument, wrongAnswers } from "../support/quiz.js";
import type { Survey } from "../support/quiz.js";
import { createTestApp, readJson } from "../support/test-app.js";
import type { LearnerName, TestApp } from "../support/test-app.js";

let t: TestApp;
let chapterId: string;

async function call(method: string, path: string, body?: unknown, as: LearnerName = "admin") {
  const response = await t.request(method, path, { as, ...(body === undefined ? {} : { body }) });
  return { status: response.status, body: await readJson(response) };
}

async function aLesson(type: "quiz" | "text" = "quiz") {
  const lesson = await call("POST", "/v1/admin/lessons", {
    chapter_id: chapterId,
    type,
    title: "Fire safety check",
    position: 0,
  });
  expect(lesson.status).toBe(201);
  return String(lesson.body.id);
}

beforeAll(async () => {
  t = await createTestApp();
  const course = await call("POST", "/v1/admin/courses", { slug: "quizzes", title: "Quizzes" });
  await call("PATCH", `/v1/admin/courses/${String(course.body.id)}`, { status: "published" });
  const chapter = await call("POST", "/v1/admin/chapters", {
    course_id: String(course.body.id),
    title: "C",
    position: 0,
    status: "published",
  });
  chapterId = String(chapter.body.id);
  await call("POST", "/v1/admin/access-rules", {
    target_type: "course",
    target_id: String(course.body.id),
    effect: "allow",
    audience: { type: "everyone" },
  });
});

afterAll(async () => {
  await t.database.drop();
});

describe("quiz lessons in the admin API", () => {
  it("creates a draft quiz lesson with its settings validated and completed", async () => {
    const lesson = await call("POST", "/v1/admin/lessons", {
      chapter_id: chapterId,
      type: "quiz",
      title: "Check",
      position: 0,
      settings: { maxAttempts: 3 },
    });

    expect(lesson.status).toBe(201);
    expect(lesson.body).toMatchObject({
      type: "quiz",
      status: "draft",
      settings: { maxAttempts: 3, passingScore: 0.8, showCorrection: "after_pass" },
    });
  });

  it("refuses invalid quiz settings", async () => {
    const lesson = await call("POST", "/v1/admin/lessons", {
      chapter_id: chapterId,
      type: "quiz",
      title: "Check",
      position: 0,
      settings: { passingScore: 2 },
    });

    expect(lesson.status).toBe(400);
    expect(lesson.body.error).toMatchObject({ code: "invalid_settings" });
  });

  it("cannot publish a quiz lesson before its questions are saved", async () => {
    const created = await call("POST", "/v1/admin/lessons", {
      chapter_id: chapterId,
      type: "quiz",
      title: "Check",
      position: 0,
      status: "published",
    });
    const id = await aLesson();

    const early = await call("PATCH", `/v1/admin/lessons/${id}`, { status: "published" });
    await call("PUT", `/v1/admin/lessons/${id}/quiz`, { document: quizDocument() });
    const later = await call("PATCH", `/v1/admin/lessons/${id}`, { status: "published" });

    expect(created.status).toBe(409);
    expect(created.body.error).toMatchObject({ code: "quiz_not_ready" });
    expect(early.status).toBe(409);
    expect(early.body.error).toMatchObject({ code: "quiz_not_ready" });
    expect(later.status).toBe(200);
  });
});

describe("PUT and GET /v1/admin/lessons/:id/quiz", () => {
  it("stores the editor document with its version, and returns it for the editor", async () => {
    const id = await aLesson();

    const empty = await call("GET", `/v1/admin/lessons/${id}/quiz`);
    const saved = await call("PUT", `/v1/admin/lessons/${id}/quiz`, { document: quizDocument() });
    const read = await call("GET", `/v1/admin/lessons/${id}/quiz`);

    expect(empty.body).toEqual({
      lesson_id: id,
      document: null,
      question_count: 0,
      version: null,
      learners_attempted: 0,
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ lesson_id: id, question_count: 2, learners_attempted: 0 });
    expect(saved.body.version).toMatch(/^[0-9a-f]{64}$/);
    expect(read.body).toEqual({ ...saved.body, document: quizDocument() });
  });

  it("keeps the version of an unchanged quiz and changes it with the questions", async () => {
    const id = await aLesson();

    const first = await call("PUT", `/v1/admin/lessons/${id}/quiz`, { document: quizDocument() });
    const same = await call("PUT", `/v1/admin/lessons/${id}/quiz`, { document: quizDocument() });
    const edited = await call("PUT", `/v1/admin/lessons/${id}/quiz`, {
      document: quizDocument("Edited prompt."),
    });

    expect(same.body.version).toBe(first.body.version);
    expect(edited.body.version).not.toBe(first.body.version);
  });

  it("reports every issue of an invalid quiz, with its path", async () => {
    const id = await aLesson();
    const [trueFalse, , single] = quizDocument();
    const broken = [
      { ...trueFalse, content: [] },
      { ...single, children: single?.children.slice(0, 1) },
    ];

    const response = await call("PUT", `/v1/admin/lessons/${id}/quiz`, { document: broken });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "invalid_content",
      details: {
        issues: [
          { code: "invalid_question", path: "0", message: "The question has no prompt" },
          { code: "invalid_question", path: "1", message: "The question needs at least 2 options" },
        ],
      },
    });
  });

  it("counts the learners who took the quiz, for the edit warning", async () => {
    const id = await aLesson();
    await call("PUT", `/v1/admin/lessons/${id}/quiz`, { document: quizDocument() });
    await call("PATCH", `/v1/admin/lessons/${id}`, { status: "published" });
    const attempt = await call("POST", `/v1/lessons/${id}/quiz/attempts`, undefined, "staff");
    await call(
      "POST",
      `/v1/lessons/${id}/quiz/attempts/${String(attempt.body.id)}/submit`,
      { answers: wrongAnswers(attempt.body.survey as Survey) },
      "staff",
    );

    const read = await call("GET", `/v1/admin/lessons/${id}/quiz`);

    expect(attempt.status).toBe(201);
    expect(read.body.learners_attempted).toBe(1);
  });

  it("refuses other lesson types, unknown lessons and non-admins", async () => {
    const text = await aLesson("text");
    const quiz = await aLesson();

    const notQuiz = await call("PUT", `/v1/admin/lessons/${text}/quiz`, {
      document: quizDocument(),
    });
    const unknown = await call(
      "GET",
      "/v1/admin/lessons/00000000-0000-4000-8000-000000000000/quiz",
    );
    const learner = await call("GET", `/v1/admin/lessons/${quiz}/quiz`, undefined, "staff");
    const otherTenant = await call(
      "GET",
      `/v1/admin/lessons/${quiz}/quiz`,
      undefined,
      "otherTenant",
    );

    expect(notQuiz.status).toBe(409);
    expect(notQuiz.body.error).toMatchObject({ code: "not_a_quiz_lesson" });
    expect(unknown.status).toBe(404);
    expect(learner.status).toBe(403);
    expect(otherTenant.status).toBe(403);
  });

  it("refuses a body without a document", async () => {
    const id = await aLesson();

    expect((await call("PUT", `/v1/admin/lessons/${id}/quiz`, {})).status).toBe(400);
  });
});

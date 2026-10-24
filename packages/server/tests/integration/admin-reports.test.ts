import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Chapter, Course, LessonDetail } from "@bebranded/elearning-core";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { quizDocument, rightAnswers, wrongAnswers } from "../support/quiz.js";
import type { Survey } from "../support/quiz.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { LearnerName, TestApp } from "../support/test-app.js";

let t: TestApp;
let course: Course;
let chapter: Chapter;
let text: LessonDetail;
let quiz: LessonDetail;

async function takeQuiz(as: LearnerName, pass: boolean) {
  const opened = await readJson(
    await t.request("POST", `/v1/lessons/${quiz.id}/quiz/attempts`, { as }),
  );
  const survey = opened.survey as Survey;
  await t.request("POST", `/v1/lessons/${quiz.id}/quiz/attempts/${String(opened.id)}/submit`, {
    as,
    body: { answers: pass ? rightAnswers(survey) : wrongAnswers(survey) },
  });
}

function report(path: string, as: LearnerName = "admin") {
  return t.request("GET", `/v1/admin/reports/${path}`, { as });
}

beforeAll(async () => {
  t = await createTestApp();
  course = aCourse(tenant, { slug: "safety-101", title: "Safety, =basics" });
  chapter = aChapter(course);
  text = aLesson(chapter, { type: "text", position: 0 });
  quiz = aLesson(chapter, {
    type: "quiz",
    content: null,
    settings: { maxAttempts: null },
    position: 1,
  });
  await seed(t.database, [
    {
      course,
      chapters: [chapter],
      lessons: [text, quiz],
      rules: [rule(course, "course", "allow")],
    },
  ]);
  await t.request("PUT", `/v1/admin/lessons/${quiz.id}/quiz`, {
    as: "admin",
    body: { document: quizDocument() },
  });
  // staff completes the course (text lesson, then the quiz); manager is assigned, past due.
  await t.request("POST", `/v1/lessons/${text.id}/start`, { as: "staff" });
  await t.request("POST", `/v1/lessons/${text.id}/complete`, { as: "staff" });
  await t.request("POST", "/v1/admin/assignments", {
    as: "admin",
    body: {
      course_id: course.id,
      audience: { type: "learner", learner_id: "manager-1" },
      due_at: "2026-05-01T00:00:00Z",
    },
  });
  await takeQuiz("staff", false);
  await takeQuiz("staff", true);
  await takeQuiz("manager", false);
  // Another tenant's learner on the same (shared-looking) ids never shows up.
  await t.request("POST", `/v1/lessons/${text.id}/start`, { as: "otherTenant" });
});

afterAll(async () => {
  await t.database.drop();
});

describe("GET /v1/admin/reports/courses/:id", () => {
  it("answers each learner's enrollment with a summary", async () => {
    const response = await report(`courses/${course.id}`);

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.course).toEqual({
      id: course.id,
      slug: "safety-101",
      title: "Safety, =basics",
      status: course.status,
    });
    expect(body.summary).toEqual({
      enrolled: 2,
      started: 2,
      completed: 1,
      overdue: 1,
      average_progress: expect.any(Number) as number,
    });
    const rows = body.data as Record<string, unknown>[];
    expect(rows.map((row) => row.learner_id)).toEqual(["staff-1", "manager-1"]);
    expect(rows[1]).toMatchObject({
      source: "assigned",
      assigned_by: "admin-1",
      due_at: "2026-05-01T00:00:00.000Z",
      overdue: true,
    });
  });

  it("downloads the same rows as CSV", async () => {
    const response = await t.request("GET", `/v1/admin/reports/courses/${course.id}?format=csv`, {
      as: "admin",
    });

    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="course-safety-101.csv"',
    );
    const lines = (await response.text()).trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "learner_id,course_id,source,assigned_by,due_at,started_at,completed_at,progress,overdue",
    );
    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatch(/^manager-1,.*,assigned,admin-1,2026-05-01T00:00:00.000Z,.*,true$/);
  });

  it.each(["not-a-uuid", "00000000-0000-4000-8000-000000000000"])(
    "answers 404 for %s",
    async (id) => {
      expect((await report(`courses/${id}`)).status).toBe(404);
    },
  );

  it("is admin only", async () => {
    expect((await report(`courses/${course.id}`, "staff")).status).toBe(403);
  });
});

describe("GET /v1/admin/reports/learners/:learnerId", () => {
  it("answers the learner's enrollments with course titles", async () => {
    const body = await readJson(await report("learners/staff-1"));

    expect(body.learner_id).toBe("staff-1");
    expect(body.summary).toMatchObject({ enrolled: 1, completed: 1 });
    expect(body.data).toEqual([
      expect.objectContaining({ course_id: course.id, course_title: "Safety, =basics" }),
    ]);
  });

  it("quotes and neutralizes the course title in CSV", async () => {
    const response = await t.request("GET", "/v1/admin/reports/learners/staff-1?format=csv", {
      as: "admin",
    });

    const [header, row] = (await response.text()).split("\r\n");
    expect(header?.endsWith(",course_title")).toBe(true);
    expect(row?.endsWith(',"Safety, =basics"')).toBe(true);
  });

  it("shows nothing of another tenant's learner", async () => {
    expect((await readJson(await report("learners/staff-9"))).data).toEqual([]);
  });

  it("decodes an encoded learner id", async () => {
    expect((await readJson(await report("learners/staff%2D1"))).learner_id).toBe("staff-1");
  });
});

describe("GET /v1/admin/reports/quizzes/:lessonId", () => {
  it("answers pass rate, averages, question stats and learner results", async () => {
    const body = await readJson(await report(`quizzes/${quiz.id}`));

    expect(body).toMatchObject({
      lesson_id: quiz.id,
      learners: 2,
      attempts: 3,
      pass_rate: 0.5,
      average_attempts: 1.5,
    });
    expect((body.questions as unknown[]).length).toBe(2);
    expect(body.learners_results).toEqual([
      expect.objectContaining({ learner_id: "manager-1", attempts: 1, passed: false }),
      expect.objectContaining({ learner_id: "staff-1", attempts: 2, best_score: 1, passed: true }),
    ]);
  });

  it("downloads per-learner rows as CSV", async () => {
    const response = await t.request("GET", `/v1/admin/reports/quizzes/${quiz.id}?format=csv`, {
      as: "admin",
    });

    const lines = (await response.text()).trimEnd().split("\r\n");
    expect(lines[0]).toBe("learner_id,attempts,best_score,passed,last_attempt_at");
    expect(lines[2]).toMatch(/^staff-1,2,1,true,2026-/);
  });

  it("answers 409 for a text lesson", async () => {
    expect((await report(`quizzes/${text.id}`)).status).toBe(409);
  });
});

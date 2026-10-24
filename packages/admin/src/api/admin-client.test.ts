import { describe, expect, it } from "vitest";

import { ElearningApiError } from "@bebranded/elearning-react";

import { createAdminClient } from "./admin-client.js";

type Call = { url: string; init: RequestInit };

function recording(reply: () => Response) {
  const calls: Call[] = [];
  const fetcher = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(reply());
  };
  return { fetcher, calls };
}

describe("createAdminClient", () => {
  it("sends JSON bodies to the admin routes with the host's cookies", async () => {
    const { fetcher, calls } = recording(() => Response.json({ id: "c" }, { status: 201 }));
    const admin = createAdminClient("/api/elearning///", fetcher);

    await admin.createCourse({ title: "T", slug: "t" });

    expect(calls[0]?.url).toBe("/api/elearning/v1/admin/courses");
    expect(calls[0]?.init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      body: '{"title":"T","slug":"t"}',
      headers: { accept: "application/json", "content-type": "application/json" },
    });
  });

  it("sends no body or content type on reads", async () => {
    const { fetcher, calls } = recording(() => Response.json({ data: [], next_cursor: null }));

    await createAdminClient("/api/elearning", fetcher).listCourses();

    expect(calls[0]?.init.body).toBeUndefined();
    expect(calls[0]?.init.headers).toEqual({ accept: "application/json" });
  });

  it("encodes ids in paths", async () => {
    const { fetcher, calls } = recording(() => Response.json({}));

    await createAdminClient("/x", fetcher).learnerReport("a/b?c");

    expect(calls[0]?.url).toBe("/x/v1/admin/reports/learners/a%2Fb%3Fc");
  });

  it.each([
    ["deleteCourse", "/courses/1"],
    ["deleteChapter", "/chapters/1"],
    ["deleteLesson", "/lessons/1"],
    ["deleteAccessRule", "/access-rules/1"],
    ["deleteAssignment", "/assignments/1"],
  ] as const)("%s sends a DELETE and accepts a 204 without body", async (method, path) => {
    const { fetcher, calls } = recording(() => new Response(null, { status: 204 }));

    await expect(createAdminClient("/x", fetcher)[method]("1")).resolves.toBeUndefined();
    expect(calls[0]).toMatchObject({ url: `/x/v1/admin${path}`, init: { method: "DELETE" } });
  });

  it("uses PUT for a quiz and PATCH for edits", async () => {
    const { fetcher, calls } = recording(() => Response.json({}));
    const admin = createAdminClient("/x", fetcher);

    await admin.saveQuiz("l1", [{ id: "q" }]);
    await admin.updateLesson("l1", { title: "New" });

    expect(calls.map((call) => call.init.method)).toEqual(["PUT", "PATCH"]);
    expect(calls[0]?.init.body).toBe('{"document":[{"id":"q"}]}');
  });

  it("throws the API error with its code", async () => {
    const body = { error: { code: "slug_taken", message: "m", request_id: "r1" } };
    const { fetcher } = recording(() => Response.json(body, { status: 409 }));

    const failure = createAdminClient("/x", fetcher).createCourse({});

    await expect(failure).rejects.toBeInstanceOf(ElearningApiError);
    await expect(failure).rejects.toMatchObject({ status: 409, code: "slug_taken" });
  });

  it("builds CSV download URLs", () => {
    expect(createAdminClient("/api/elearning/").reportCsvUrl("courses/1")).toBe(
      "/api/elearning/v1/admin/reports/courses/1?format=csv",
    );
  });

  it.each([
    ["getCourse", "GET", "/courses/1"],
    ["getLesson", "GET", "/lessons/1"],
    ["getQuiz", "GET", "/lessons/1/quiz"],
    ["getFile", "GET", "/files/1"],
    ["listAssignments", "GET", "/courses/1/assignments"],
    ["listAttemptGrants", "GET", "/lessons/1/quiz/attempt-grants"],
    ["courseReport", "GET", "/reports/courses/1"],
    ["quizReport", "GET", "/reports/quizzes/1"],
  ] as const)("%s reads %s %s", async (method, verb, path) => {
    const { fetcher, calls } = recording(() => Response.json({}));

    await createAdminClient("/x", fetcher)[method]("1");

    expect(calls[0]).toMatchObject({ url: `/x/v1/admin${path}`, init: { method: verb } });
  });

  it.each([
    ["updateCourse", "PATCH", "/courses/1"],
    ["updateChapter", "PATCH", "/chapters/1"],
    ["grantAttempts", "POST", "/lessons/1/quiz/attempt-grants"],
  ] as const)("%s writes %s %s", async (method, verb, path) => {
    const { fetcher, calls } = recording(() => Response.json({}));

    await createAdminClient("/x", fetcher)[method]("1", { a: 1 });

    expect(calls[0]).toMatchObject({ url: `/x/v1/admin${path}`, init: { method: verb } });
  });

  it.each([
    ["createChapter", "/chapters"],
    ["createLesson", "/lessons"],
    ["reorder", "/reorder"],
    ["createFileUpload", "/files/uploads"],
    ["createVideoUpload", "/videos/uploads"],
    ["createAccessRule", "/access-rules"],
    ["createAssignment", "/assignments"],
  ] as const)("%s posts to %s", async (method, path) => {
    const { fetcher, calls } = recording(() => Response.json({}));

    await createAdminClient("/x", fetcher)[method]({ a: 1 });

    expect(calls[0]).toMatchObject({ url: `/x/v1/admin${path}`, init: { method: "POST" } });
  });
});

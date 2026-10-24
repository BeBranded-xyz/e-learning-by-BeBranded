import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { fakeVideoProvider } from "@bebranded/elearning-video/testing";
import { aChapter, aCourse, aLesson, aVideoAsset } from "../../../db/tests/support/factories.js";
import { quizDocument } from "../support/quiz.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

let t: TestApp;
const course = aCourse(tenant, { status: "draft", publishedAt: null });
const chapter = aChapter(course, { status: "draft" });
const text = aLesson(chapter, {
  status: "draft",
  content: [
    {
      id: "text",
      type: "paragraph",
      content: [{ type: "text", text: "Draft content <script>alert(1)</script>", styles: {} }],
      props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
      children: [],
    },
  ],
});
const quiz = aLesson(chapter, { type: "quiz", status: "draft", content: null, settings: {} });
const video = aLesson(chapter, { type: "video", status: "draft", content: null, settings: {} });
const path = (id: string) => `/v1/admin/lessons/${id}/preview`;

beforeAll(async () => {
  t = await createTestApp({
    video: fakeVideoProvider({
      playbackUrl: () => "https://video.example.com/manifest.m3u8",
      webhookSecret: "obvious-fake-test-secret",
    }),
  });
  await seed(t.database, [
    {
      course,
      chapters: [chapter],
      lessons: [text, quiz, video],
      rules: [rule(course, "course", "allow")],
    },
  ]);
  await t.request("PUT", `/v1/admin/lessons/${quiz.id}/quiz`, {
    as: "admin",
    body: { document: quizDocument() },
  });
  await t.database.storage.transaction((tx) =>
    tx.saveVideoAsset(
      { tenantId: tenant, includeShared: false },
      aVideoAsset(video, { status: "ready", provider: "fake", durationSeconds: 30 }),
    ),
  );
});
afterAll(async () => {
  await t.database.drop();
});

describe("admin preview", () => {
  it("renders a draft safely without publishing it or creating enrollment/progress", async () => {
    const response = await t.request("GET", path(text.id), { as: "admin" });
    const body = await readJson(response);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: text.id,
      title: text.title,
      type: "text",
      video: null,
      survey: null,
    });
    expect(body.html).toContain("Draft content");
    expect(body.html).not.toContain("<script>");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const counts = await sql<{
      count: number;
    }>`select count(*)::int as count from ${sql.id(t.database.schema, "enrollments")}`.execute(
      t.database.admin,
    );
    expect(counts.rows[0]?.count).toBe(0);
    expect(
      (await t.database.storage.findLesson({ tenantId: tenant, includeShared: false }, text.id))
        ?.status,
    ).toBe("draft");
  });

  it("renders quiz questions without answers or attempts", async () => {
    const body = await readJson(await t.request("GET", path(quiz.id), { as: "admin" }));
    expect(body.survey).not.toBeNull();
    const serialized = JSON.stringify(body.survey);
    expect(serialized).not.toMatch(/correct|answer|explanation|points/i);
    const counts = await sql<{
      count: number;
    }>`select count(*)::int as count from ${sql.id(t.database.schema, "quiz_attempts")}`.execute(
      t.database.admin,
    );
    expect(counts.rows[0]?.count).toBe(0);
  });

  it("offers the ready video's provider playback URL without starting playback tracking", async () => {
    const body = await readJson(await t.request("GET", path(video.id), { as: "admin" }));
    expect(body.video).toMatchObject({
      url: "https://video.example.com/manifest.m3u8",
      captions: [],
    });
    const counts = await sql<{
      count: number;
    }>`select count(*)::int as count from ${sql.id(t.database.schema, "video_sessions")}`.execute(
      t.database.admin,
    );
    expect(counts.rows[0]?.count).toBe(0);
  });

  it.each([
    [undefined, 401],
    ["staff", 403],
    ["otherTenant", 403],
  ] as const)("refuses %s", async (as, status) => {
    const response = await t.request("GET", path(text.id), as === undefined ? {} : { as });
    expect(response.status).toBe(status);
  });

  it("does not reveal a different tenant's draft, and rejects malformed identifiers", async () => {
    const foreign = aCourse(null, { status: "draft", publishedAt: null });
    const foreignChapter = aChapter(foreign);
    const foreignLesson = aLesson(foreignChapter);
    await seed(t.database, [
      { course: foreign, chapters: [foreignChapter], lessons: [foreignLesson] },
    ]);
    expect((await t.request("GET", path(foreignLesson.id), { as: "admin" })).status).toBe(404);
    expect((await t.request("GET", path("not-a-uuid"), { as: "admin" })).status).toBe(404);
  });
});

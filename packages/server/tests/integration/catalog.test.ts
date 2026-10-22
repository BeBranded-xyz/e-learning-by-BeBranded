import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enrollmentIdSchema, learnerIdSchema, tenantIdSchema } from "@bebranded/elearning-core";
import type { Course } from "@bebranded/elearning-core";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import {
  createTestApp,
  learnerAudience,
  readJson,
  rule,
  seed,
  tenant,
} from "../support/test-app.js";
import type { LearnerName, TestApp } from "../support/test-app.js";

let t: TestApp;
const courses: Record<string, Course> = {};

async function catalogSlugs(as: LearnerName): Promise<string[]> {
  const body = await readJson(await t.request("GET", "/v1/courses", { as }));
  return (body.data as { slug: string }[]).map((course) => course.slug).sort();
}

beforeAll(async () => {
  t = await createTestApp();
  const make = (slug: string, overrides: Partial<Course> = {}) => {
    courses[slug] = aCourse(tenant, { slug, title: slug, ...overrides });
    return courses[slug];
  };
  const open = make("open");
  const managers = make("managers-only");
  const graded = make("grade-3");
  const draft = make("draft", { status: "draft", publishedAt: null });
  const archived = make("archived", { status: "archived" });
  const noRule = make("no-rule");
  const denied = make("denied-interns");
  const assigned = make("assigned", { enrollmentMode: "assignment_only" });
  const personal = make("personal");
  const other = aCourse(tenantIdSchema.parse("tenant-b"), { slug: "other-tenant" });
  await seed(t.database, [
    { course: open, rules: [rule(open, "course", "allow")] },
    {
      course: managers,
      rules: [rule(managers, "course", "allow", { type: "role", role: "manager" })],
    },
    { course: graded, rules: [rule(graded, "course", "allow", { type: "grade_min", grade: 3 })] },
    { course: draft, rules: [rule(draft, "course", "allow")] },
    { course: archived, rules: [rule(archived, "course", "allow")] },
    { course: noRule },
    {
      course: denied,
      rules: [
        rule(denied, "course", "allow"),
        rule(denied, "course", "deny", { type: "role", role: "staff" }),
      ],
    },
    { course: assigned, rules: [rule(assigned, "course", "allow")] },
    { course: personal, rules: [rule(personal, "course", "allow", learnerAudience("manager"))] },
  ]);
  await t.database.storage.transaction((tx) => tx.insertCourse(other));
});

afterAll(async () => {
  await t.database.drop();
});

describe("GET /v1/courses (authorization per audience)", () => {
  it("shows a staff member only the courses open to everyone", async () => {
    expect(await catalogSlugs("staff")).toEqual(["open"]);
  });

  it("shows a manager role, grade and personal courses, and lets a matching deny win", async () => {
    expect(await catalogSlugs("manager")).toEqual(["grade-3", "managers-only", "open", "personal"]);
  });

  it("never shows drafts, archived courses, courses without rules or other tenants' courses", async () => {
    const visible = [
      ...(await catalogSlugs("staff")),
      ...(await catalogSlugs("manager")),
      ...(await catalogSlugs("otherTenant")),
    ];

    expect(
      visible.filter((slug) => ["draft", "archived", "no-rule", "other-tenant"].includes(slug)),
    ).toEqual([]);
  });

  it("hides an assignment-only course until the learner is enrolled", async () => {
    const assigned = courses.assigned;
    if (assigned === undefined) throw new Error("fixture missing");
    expect(await catalogSlugs("staff")).not.toContain("assigned");

    await t.database.storage.transaction((tx) =>
      tx.saveEnrollment(
        { tenantId: tenant, includeShared: false },
        {
          id: enrollmentIdSchema.parse(crypto.randomUUID()),
          courseId: assigned.id,
          learnerId: learnerIdSchema.parse("staff-1"),
          source: "assigned",
          assignedBy: learnerIdSchema.parse("admin-1"),
          dueAt: new Date("2026-07-01T00:00:00Z"),
          startedAt: null,
          completedAt: null,
          progress: 0,
        },
      ),
    );

    expect(await catalogSlugs("staff")).toContain("assigned");
  });

  it("wraps the collection and exposes snake_case fields only", async () => {
    const body = await readJson(await t.request("GET", "/v1/courses", { as: "staff" }));

    expect(body.next_cursor).toBeNull();
    expect(
      (body.data as Record<string, unknown>[]).find((course) => course.slug === "open"),
    ).toEqual({
      id: courses.open?.id,
      slug: "open",
      title: "open",
      summary: null,
      cover_image_url: null,
      locale: "en",
      enrollment_mode: "self",
      enrollment: null,
    });
  });
});

describe("GET /v1/courses/:slug", () => {
  it("answers 404, not 403, for a course the learner cannot see (no existence leak)", async () => {
    const hidden = await t.request("GET", "/v1/courses/managers-only", { as: "staff" });
    const missing = await t.request("GET", "/v1/courses/does-not-exist", { as: "staff" });

    expect(hidden.status).toBe(404);
    expect(await readJson(hidden)).toEqual({
      error: {
        ...((await readJson(missing)).error as object),
        request_id: hidden.headers.get("x-request-id"),
      },
    });
  });

  it("returns only the chapters and lessons the learner may see, in order", async () => {
    const course = aCourse(tenant, { slug: "tree" });
    const intro = aChapter(course, { position: 0, title: "Intro" });
    const draftChapter = aChapter(course, { position: 1, title: "Draft chapter", status: "draft" });
    const managerChapter = aChapter(course, { position: 2, title: "For managers" });
    const welcome = aLesson(intro, { position: 0, title: "Welcome" });
    const draftLesson = aLesson(intro, { position: 1, title: "Draft lesson", status: "draft" });
    const deniedLesson = aLesson(intro, { position: 2, title: "Not for staff" });
    const inDraft = aLesson(draftChapter, { title: "Hidden by chapter" });
    const managerLesson = aLesson(managerChapter, { title: "Leadership", isRequired: false });
    await seed(t.database, [
      {
        course,
        chapters: [intro, draftChapter, managerChapter],
        lessons: [welcome, draftLesson, deniedLesson, inDraft, managerLesson],
        rules: [
          rule(course, "course", "allow"),
          rule(deniedLesson, "lesson", "deny", { type: "role", role: "staff" }),
          rule(managerChapter, "chapter", "allow", { type: "role", role: "manager" }),
        ],
      },
    ]);

    const staff = await readJson(await t.request("GET", "/v1/courses/tree", { as: "staff" }));
    const chapters = staff.chapters as {
      title: string;
      lessons: { title: string; status: string }[];
    }[];

    expect(chapters.map((chapter) => chapter.title)).toEqual(["Intro"]);
    expect(chapters[0]?.lessons).toEqual([
      expect.objectContaining({ title: "Welcome", status: "not_started", is_required: true }),
    ]);
    expect(staff.progress).toEqual({
      completed_required: 0,
      total_required: 1,
      ratio: 0,
      is_complete: false,
    });
    expect(JSON.stringify(staff)).not.toMatch(/Draft|Not for staff|Leadership|Hidden by chapter/);
  });
});

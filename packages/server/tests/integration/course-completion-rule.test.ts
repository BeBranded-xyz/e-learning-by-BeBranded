import { expect, it } from "vitest";
import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";

it("enforces the course percentage on the server and keeps earned completion dates", async () => {
  const t = await createTestApp();
  const course = aCourse(tenant, {
    slug: "percentage",
    completionRule: { type: "percentage", threshold: 0.5 },
  });
  const chapter = aChapter(course);
  const first = aLesson(chapter, { content: null });
  const second = aLesson(chapter, { content: null, position: 1 });
  try {
    await seed(t.database, [
      {
        course,
        chapters: [chapter],
        lessons: [first, second],
        rules: [rule(course, "course", "allow")],
      },
    ]);
    const completed = await readJson(
      await t.request("POST", `/v1/lessons/${first.id}/complete`, { as: "staff" }),
    );
    expect(completed.enrollment).toMatchObject({
      progress: 0.5,
      completed_at: "2026-06-01T09:00:00.000Z",
    });
    await t.request("PATCH", `/v1/admin/courses/${course.id}`, {
      as: "admin",
      body: { completion_rule: { type: "all_required_lessons" } },
    });
    const view = await readJson(await t.request("GET", "/v1/courses/percentage", { as: "staff" }));
    expect(view.progress).toMatchObject({ is_complete: true, ratio: 0.5 });
    const started = await readJson(
      await t.request("POST", `/v1/lessons/${second.id}/start`, { as: "staff" }),
    );
    expect(started.enrollment).toMatchObject({ completed_at: "2026-06-01T09:00:00.000Z" });
    for (const threshold of [0, 1.01, "0.5", null]) {
      expect(
        (
          await t.request("PATCH", `/v1/admin/courses/${course.id}`, {
            as: "admin",
            body: { completion_rule: { type: "percentage", threshold } },
          })
        ).status,
      ).toBe(400);
    }
  } finally {
    await t.database.drop();
  }
});

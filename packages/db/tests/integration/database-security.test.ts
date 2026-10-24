import { randomUUID } from "node:crypto";

import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aChapter, aCourse, tenantA } from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;
const tables = [
  "courses",
  "chapters",
  "lessons",
  "access_rules",
  "enrollments",
  "lesson_progress",
  "event_outbox",
  "schema_migrations",
  "video_assets",
  "video_progress",
  "video_sessions",
  "quizzes",
  "quiz_attempts",
  "course_assignments",
  "files",
];

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

describe("row level security", () => {
  it("is enabled on every table of the schema", async () => {
    const result = await sql<{ relname: string; relrowsecurity: boolean }>`
      SELECT c.relname, c.relrowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${database.schema} AND c.relkind = 'r'`.execute(database.admin);

    expect(result.rows.map((row) => row.relname).sort()).toEqual([...tables].sort());
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("gives another role no access, even after it is granted SELECT (default deny)", async () => {
    await database.storage.transaction((tx) => tx.insertCourse(aCourse(tenantA.tenantId)));
    const role = `reader_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const password = randomUUID();
    await sql`CREATE ROLE ${sql.id(role)} LOGIN PASSWORD ${sql.lit(password)}`.execute(
      database.admin,
    );
    await sql`GRANT USAGE ON SCHEMA ${sql.id(database.schema)} TO ${sql.id(role)}`.execute(
      database.admin,
    );
    await sql`GRANT SELECT ON ${sql.id(database.schema, "courses")} TO ${sql.id(role)}`.execute(
      database.admin,
    );
    const url = new URL(database.url);
    url.username = role;
    url.password = password;
    const reader = new Kysely<Record<string, never>>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: url.toString(), max: 1 }),
      }),
    });
    try {
      const rows = await sql`SELECT id FROM ${sql.id(database.schema, "courses")}`.execute(reader);
      expect(rows.rows).toEqual([]);
      await expect(
        sql`SELECT id FROM ${sql.id(database.schema, "lessons")}`.execute(reader),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await reader.destroy();
      await sql`DROP OWNED BY ${sql.id(role)}`.execute(database.admin);
      await sql`DROP ROLE ${sql.id(role)}`.execute(database.admin);
    }
  });
});

describe("constraints and triggers", () => {
  const table = (name: string) => sql.id(database.schema, name);

  it.each([
    ["an invalid slug", { slug: "Bad Slug" }],
    ["an http cover URL", { cover_image_url: "http://example.com/a.png" }],
    ["an unknown status", { status: "deleted" }],
    ["a blank title", { title: "   " }],
  ])("rejects a course with %s", async (_label, override) => {
    const values = {
      slug: `c-${randomUUID().slice(0, 8)}`,
      title: "Title",
      cover_image_url: null as string | null,
      status: "draft",
      ...override,
    };

    await expect(
      sql`INSERT INTO ${table("courses")} (slug, title, cover_image_url, status)
          VALUES (${values.slug}, ${values.title}, ${values.cover_image_url}, ${values.status})`.execute(
        database.admin,
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  it.each([
    ["everyone with a value", "everyone", "x"],
    ["a role without value", "role", null],
    ["a non-numeric grade", "grade_min", "three"],
  ])("rejects an access rule for %s", async (_label, type, value) => {
    await expect(
      sql`INSERT INTO ${table("access_rules")} (target_type, target_id, effect, audience_type, audience_value)
          VALUES ('course', ${randomUUID()}, 'allow', ${type}, ${value})`.execute(database.admin),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("rejects a chapter whose course does not exist", async () => {
    const course = aCourse(tenantA.tenantId);

    await expect(
      sql`INSERT INTO ${table("chapters")} (course_id, title, position) VALUES (${course.id}, 'T', 0)`.execute(
        database.admin,
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("sets updated_at on every update", async () => {
    const course = aCourse(tenantA.tenantId);
    const chapter = aChapter(course);
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      await tx.insertChapter(tenantA, chapter);
    });
    await sql`UPDATE ${table("chapters")} SET updated_at = '2000-01-01' WHERE id = ${chapter.id}`.execute(
      database.admin,
    );

    await database.storage.transaction((tx) =>
      tx.updateChapter(tenantA, chapter.id, { title: "New" }),
    );

    const row = await sql<{
      updated_at: Date;
    }>`SELECT updated_at FROM ${table("chapters")} WHERE id = ${chapter.id}`.execute(
      database.admin,
    );
    expect(row.rows[0]?.updated_at.getFullYear()).toBeGreaterThan(2000);
  });

  it("enforces one enrollment per learner and course", async () => {
    const course = aCourse(tenantA.tenantId);
    await database.storage.transaction((tx) => tx.insertCourse(course));
    const insert = () =>
      sql`INSERT INTO ${table("enrollments")} (course_id, learner_id, source) VALUES (${course.id}, 'learner-x', 'self')`.execute(
        database.admin,
      );
    await insert();

    await expect(insert()).rejects.toThrow(/duplicate key/);
  });
});

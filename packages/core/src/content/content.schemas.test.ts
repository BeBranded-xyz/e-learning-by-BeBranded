import { describe, expect, it } from "vitest";

import { testUuid } from "../../tests/factories/access.js";
import {
  courseSchema,
  lessonSchema,
  localeSchema,
  slugSchema,
  textLessonSettingsSchema,
} from "./content.schemas.js";
import { learnerIdSchema, tenantIdSchema } from "./ids.js";

function validCourse(): Record<string, unknown> {
  return {
    id: testUuid(),
    tenantId: null,
    slug: "safety-basics",
    title: "Safety basics",
    summary: null,
    coverImageUrl: "https://cdn.example.com/cover.png",
    status: "published",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    completionRule: { type: "all_required_lessons" },
    enrollmentMode: "self",
    locale: "en",
    metadata: {},
  };
}

describe("slugSchema", () => {
  it.each(["intro", "safety-basics-2", "a1"])("accepts %s", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each([
    "",
    "Intro",
    "two--hyphens",
    "-leading",
    "trailing-",
    "with space",
    "é",
    "a".repeat(101),
  ])("rejects %j", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });
});

describe("localeSchema", () => {
  it.each(["en", "fr", "fr-FR"])("accepts %s", (locale) => {
    expect(localeSchema.safeParse(locale).success).toBe(true);
  });

  it.each(["EN", "english", "fr_FR", "fr-fr", ""])("rejects %j", (locale) => {
    expect(localeSchema.safeParse(locale).success).toBe(false);
  });
});

describe("courseSchema", () => {
  it("accepts a valid course", () => {
    expect(courseSchema.safeParse(validCourse()).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(courseSchema.safeParse({ ...validCourse(), extra: true }).success).toBe(false);
  });

  it.each([
    ["a javascript: cover URL", { coverImageUrl: "javascript:alert(1)" }],
    ["a plain http cover URL", { coverImageUrl: "http://cdn.example.com/cover.png" }],
    ["a data: cover URL", { coverImageUrl: "data:image/png;base64,AAAA" }],
    ["an empty title", { title: "   " }],
    ["a title over 200 characters", { title: "x".repeat(201) }],
    ["an unknown status", { status: "deleted" }],
    ["an unknown completion rule", { completionRule: { type: "any_lesson" } }],
    ["a non-uuid id", { id: "course-1" }],
  ])("rejects %s", (_label, override) => {
    expect(courseSchema.safeParse({ ...validCourse(), ...override }).success).toBe(false);
  });

  it("trims the title", () => {
    const parsed = courseSchema.parse({ ...validCourse(), title: "  Safety  " });

    expect(parsed.title).toBe("Safety");
  });
});

describe("lessonSchema", () => {
  const lesson = {
    id: testUuid(),
    chapterId: testUuid(),
    type: "text",
    title: "Welcome",
    position: 0,
    status: "draft",
    isRequired: true,
    estimatedMinutes: 5,
  };

  it("accepts a valid lesson", () => {
    expect(lessonSchema.safeParse(lesson).success).toBe(true);
  });

  it.each([
    ["a negative position", { position: -1 }],
    ["a fractional position", { position: 1.5 }],
    ["zero estimated minutes", { estimatedMinutes: 0 }],
    ["an unknown type", { type: "pdf" }],
  ])("rejects %s", (_label, override) => {
    expect(lessonSchema.safeParse({ ...lesson, ...override }).success).toBe(false);
  });
});

describe("textLessonSettingsSchema", () => {
  it("defaults requireScrollToEnd to false", () => {
    expect(textLessonSettingsSchema.parse({})).toEqual({ requireScrollToEnd: false });
  });

  it("rejects unknown settings", () => {
    expect(textLessonSettingsSchema.safeParse({ allowSeeking: true }).success).toBe(false);
  });
});

describe("host identifiers", () => {
  it("trims and accepts opaque learner and tenant ids", () => {
    expect(learnerIdSchema.parse("  user_42 ")).toBe("user_42");
    expect(tenantIdSchema.parse("company-7")).toBe("company-7");
  });

  it.each(["", "   ", "x".repeat(256)])("rejects the id %j", (id) => {
    expect(learnerIdSchema.safeParse(id).success).toBe(false);
    expect(tenantIdSchema.safeParse(id).success).toBe(false);
  });
});

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  accessRuleIdSchema,
  chapterIdSchema,
  courseIdSchema,
  lessonIdSchema,
  validateLessonDocument,
} from "@bebranded/elearning-core";
import type {
  AccessRule,
  Audience,
  Chapter,
  Course,
  JsonValue,
  LessonDetail,
  StorageAdapter,
  StorageTransaction,
} from "@bebranded/elearning-core";

import { fireLesson, leadershipLesson, readingLesson, welcomeLesson } from "./demo-content.js";

const scope = { tenantId: null, includeShared: false };

function course(slug: string, title: string, overrides: Partial<Course> = {}): Course {
  return {
    id: courseIdSchema.parse(randomUUID()),
    tenantId: null,
    slug,
    title,
    summary: null,
    coverImageUrl: null,
    status: "published",
    publishedAt: new Date(),
    completionRule: { type: "all_required_lessons" },
    enrollmentMode: "self",
    locale: "en",
    metadata: {},
    ...overrides,
  };
}

function chapter(owner: Course, title: string, position: number): Chapter {
  return {
    id: chapterIdSchema.parse(randomUUID()),
    courseId: owner.id,
    title,
    position,
    status: "published",
  };
}

/** Every document goes through the same validation as the admin API. */
function lesson(
  parent: Chapter,
  spec: { title: string; position: number; content: unknown },
  overrides: Partial<LessonDetail> = {},
): LessonDetail {
  const { title, position, content } = spec;
  const document = validateLessonDocument(content);
  if (!document.ok)
    throw new Error(`Invalid demo content for "${title}": ${JSON.stringify(document.error)}`);
  const stored: JsonValue = z.json().parse(JSON.parse(JSON.stringify(document.value)));
  return {
    id: lessonIdSchema.parse(randomUUID()),
    chapterId: parent.id,
    courseId: parent.courseId,
    type: "text",
    title,
    position,
    status: "published",
    isRequired: true,
    estimatedMinutes: 5,
    content: stored,
    contentSchemaVersion: 1,
    settings: { requireScrollToEnd: false },
    ...overrides,
  };
}

function allow(target: Course, audience: Audience): AccessRule {
  return {
    id: accessRuleIdSchema.parse(randomUUID()),
    tenantId: null,
    targetType: "course",
    targetId: target.id,
    effect: "allow",
    audience,
  };
}

async function insert(
  tx: StorageTransaction,
  entry: { course: Course; chapters: Chapter[]; lessons: LessonDetail[]; rules: AccessRule[] },
) {
  await tx.insertCourse(entry.course);
  for (const item of entry.chapters) await tx.insertChapter(scope, item);
  for (const item of entry.lessons) await tx.insertLesson(scope, item);
  for (const rule of entry.rules) await tx.insertAccessRule(rule);
}

type CatalogEntry = {
  course: Course;
  chapters: Chapter[];
  lessons: LessonDetail[];
  rules: AccessRule[];
};

/** Three courses: one for everyone, one for managers only, one draft nobody sees. */
function demoCatalog(): CatalogEntry[] {
  const safety = course("workplace-safety", "Workplace safety", {
    summary: "The basics everyone at Acme Corp needs.",
  });
  const basics = chapter(safety, "Basics", 0);
  const further = chapter(safety, "Going further", 1);
  const leading = course("leading-a-team", "Leading a team", { summary: "For managers only." });
  const firstSteps = chapter(leading, "First steps", 0);
  const draft = course("next-quarter", "Next quarter's course", {
    status: "draft",
    publishedAt: null,
  });
  return [
    {
      course: safety,
      chapters: [basics, further],
      lessons: [
        lesson(basics, { title: "Welcome", position: 0, content: welcomeLesson }),
        lesson(
          basics,
          { title: "Fire procedures", position: 1, content: fireLesson },
          { estimatedMinutes: 10 },
        ),
        lesson(
          further,
          { title: "Further reading", position: 0, content: readingLesson },
          { isRequired: false, estimatedMinutes: null },
        ),
      ],
      rules: [allow(safety, { type: "everyone" })],
    },
    {
      course: leading,
      chapters: [firstSteps],
      lessons: [
        lesson(firstSteps, { title: "Your first week", position: 0, content: leadershipLesson }),
      ],
      rules: [allow(leading, { type: "role", role: "manager" })],
    },
    { course: draft, chapters: [], lessons: [], rules: [allow(draft, { type: "everyone" })] },
  ];
}

/** Creates the demo catalog unless it already exists. Returns false when it was already there. */
export async function seedDemo(storage: StorageAdapter): Promise<boolean> {
  if ((await storage.findCourseBySlug(scope, "workplace-safety")) !== null) return false;
  const catalog = demoCatalog();
  await storage.transaction(async (tx) => {
    for (const entry of catalog) await insert(tx, entry);
  });
  return true;
}

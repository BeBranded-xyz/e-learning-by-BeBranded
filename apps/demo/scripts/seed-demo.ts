import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  accessRuleIdSchema,
  chapterIdSchema,
  courseIdSchema,
  lessonIdSchema,
  validateLessonDocument,
  videoAssetIdSchema,
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
  VideoAsset,
} from "@bebranded/elearning-core";

import { DEMO_VIDEO_SECONDS } from "../lib/demo-video.js";
import { demoQuiz } from "./demo-quiz.js";
import {
  extinguisherNotes,
  fireLesson,
  leadershipLesson,
  readingLesson,
  welcomeLesson,
} from "./demo-content.js";

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
    allowLearnerExport: false,
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

/** Every demo video plays the local test pattern (lib/demo-video.ts), already "processed". */
function readyVideo(owner: LessonDetail): VideoAsset {
  return {
    id: videoAssetIdSchema.parse(randomUUID()),
    lessonId: owner.id,
    provider: "fake",
    providerAssetId: `demo-${owner.id}`,
    status: "ready",
    durationSeconds: DEMO_VIDEO_SECONDS,
    thumbnailUrl: null,
    captions: [],
  };
}

type CatalogEntry = {
  course: Course;
  chapters: Chapter[];
  lessons: LessonDetail[];
  rules: AccessRule[];
};

async function insert(tx: StorageTransaction, entry: CatalogEntry) {
  await tx.insertCourse(entry.course);
  for (const item of entry.chapters) await tx.insertChapter(scope, item);
  for (const item of entry.lessons) await tx.insertLesson(scope, item);
  for (const item of entry.lessons.filter((candidate) => candidate.type === "video"))
    await tx.saveVideoAsset(scope, readyVideo(item));
  for (const item of entry.lessons.filter((candidate) => candidate.type === "quiz"))
    await tx.saveQuiz(scope, demoQuiz(item));
  for (const rule of entry.rules) await tx.insertAccessRule(rule);
}

/** A course with one required video lesson that cannot be skipped through (spec 06). */
function videoCourse(): CatalogEntry {
  const videos = course("video-basics", "Video basics", {
    summary: "Watch the whole video to complete the lesson.",
  });
  const equipment = chapter(videos, "Equipment", 0);
  const extinguisher = lesson(
    equipment,
    { title: "Using a fire extinguisher", position: 0, content: extinguisherNotes },
    {
      type: "video",
      estimatedMinutes: 1,
      settings: { allowSeeking: false, maxPlaybackRate: 2, completionThreshold: 0.95 },
    },
  );
  return {
    course: videos,
    chapters: [equipment],
    lessons: [extinguisher],
    rules: [allow(videos, { type: "everyone" })],
  };
}

/** A course with one required quiz, graded on the server, with two attempts (spec 07). */
function quizCourse(): CatalogEntry {
  const quizzes = course("fire-safety-check", "Fire safety check", {
    summary: "Pass the quiz to complete the course.",
  });
  const check = chapter(quizzes, "Check", 0);
  const fireQuiz = lesson(
    check,
    { title: "Fire safety quiz", position: 0, content: [] },
    {
      type: "quiz",
      estimatedMinutes: 3,
      settings: {
        passingScore: 0.75,
        maxAttempts: 2,
        shuffleOptions: true,
        showCorrection: "after_pass",
      },
    },
  );
  return {
    course: quizzes,
    chapters: [check],
    lessons: [fireQuiz],
    rules: [allow(quizzes, { type: "everyone" })],
  };
}

/** Five courses: for everyone, for managers only, a draft nobody sees, a video and a quiz course. */
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
    videoCourse(),
    quizCourse(),
  ];
}

/** Creates the demo courses that do not exist yet, by slug. Returns the slugs it created. */
export async function seedDemo(storage: StorageAdapter): Promise<string[]> {
  const missing: CatalogEntry[] = [];
  for (const entry of demoCatalog()) {
    if ((await storage.findCourseBySlug(scope, entry.course.slug)) === null) missing.push(entry);
  }
  await storage.transaction(async (tx) => {
    for (const entry of missing) await insert(tx, entry);
  });
  return missing.map((entry) => entry.course.slug);
}

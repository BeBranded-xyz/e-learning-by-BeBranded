import { randomUUID } from "node:crypto";

import {
  accessRuleIdSchema,
  chapterIdSchema,
  courseIdSchema,
  learnerIdSchema,
  lessonIdSchema,
  tenantIdSchema,
  videoAssetIdSchema,
} from "@bebranded/elearning-core";
import type {
  AccessRule,
  Chapter,
  Course,
  LessonDetail,
  TenantId,
  TenantScope,
  VideoAsset,
} from "@bebranded/elearning-core";

// Synthetic data only (modules/open-source): fake tenants, learners and courses.

export const tenantA: TenantScope = {
  tenantId: tenantIdSchema.parse("tenant-a"),
  includeShared: false,
};
export const tenantB: TenantScope = {
  tenantId: tenantIdSchema.parse("tenant-b"),
  includeShared: false,
};
export const singleTenant: TenantScope = { tenantId: null, includeShared: false };
export const learner = learnerIdSchema.parse("learner-1");
export const otherLearner = learnerIdSchema.parse("learner-2");

let counter = 0;

export function aCourse(tenantId: TenantId | null, overrides: Partial<Course> = {}): Course {
  counter += 1;
  return {
    id: courseIdSchema.parse(randomUUID()),
    tenantId,
    slug: `course-${counter}`,
    title: `Course ${counter}`,
    summary: null,
    coverImageUrl: null,
    status: "published",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    completionRule: { type: "all_required_lessons" },
    enrollmentMode: "self",
    locale: "en",
    metadata: {},
    ...overrides,
  };
}

export function aChapter(course: Course, overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: chapterIdSchema.parse(randomUUID()),
    courseId: course.id,
    title: "Chapter",
    position: 0,
    status: "published",
    ...overrides,
  };
}

export function aLesson(chapter: Chapter, overrides: Partial<LessonDetail> = {}): LessonDetail {
  return {
    id: lessonIdSchema.parse(randomUUID()),
    chapterId: chapter.id,
    courseId: chapter.courseId,
    type: "text",
    title: "Lesson",
    position: 0,
    status: "published",
    isRequired: true,
    estimatedMinutes: 5,
    content: [{ type: "paragraph", content: "Hello" }],
    contentSchemaVersion: 1,
    settings: { requireScrollToEnd: false },
    ...overrides,
  };
}

export function anAllowRule(
  tenantId: TenantId | null,
  target: { id: string },
  targetType: AccessRule["targetType"] = "course",
): AccessRule {
  return {
    id: accessRuleIdSchema.parse(randomUUID()),
    tenantId,
    targetType,
    targetId: target.id,
    effect: "allow",
    audience: { type: "everyone" },
  };
}

export function aVideoAsset(lesson: LessonDetail, overrides: Partial<VideoAsset> = {}): VideoAsset {
  counter += 1;
  return {
    id: videoAssetIdSchema.parse(randomUUID()),
    lessonId: lesson.id,
    provider: "fake",
    providerAssetId: `asset-${counter}`,
    status: "uploading",
    durationSeconds: null,
    thumbnailUrl: null,
    captions: [],
    ...overrides,
  };
}

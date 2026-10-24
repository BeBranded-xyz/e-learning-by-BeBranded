import { randomUUID } from "node:crypto";

import {
  accessRuleIdSchema,
  assignmentIdSchema,
  chapterIdSchema,
  courseIdSchema,
  learnerIdSchema,
  lessonIdSchema,
  quizAttemptIdSchema,
  quizIdSchema,
  tenantIdSchema,
  videoAssetIdSchema,
} from "@bebranded/elearning-core";
import type {
  AccessRule,
  AssignmentAudience,
  Chapter,
  CourseAssignment,
  Course,
  LearnerId,
  LessonDetail,
  Quiz,
  QuizAttempt,
  QuizDefinition,
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
    allowLearnerExport: false,
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

export const aDefinition = (prompt = "Is the exit marked in green?"): QuizDefinition => ({
  questions: [
    { id: "q-1", kind: "true_false", prompt, points: 1, explanation: "", intro: [], answer: true },
  ],
  outro: [],
});

/** A SHA-256-shaped version; the real hash is computed by the server. */
export const aVersion = (digit = "a") => digit.repeat(64);

export function aQuiz(lesson: LessonDetail, overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: quizIdSchema.parse(randomUUID()),
    lessonId: lesson.id,
    editorDocument: [{ id: "q-1", type: "trueFalseQuestion" }],
    definition: aDefinition(),
    version: aVersion(),
    ...overrides,
  };
}

export function anAttempt(
  quiz: Quiz,
  learnerId: LearnerId,
  overrides: Partial<QuizAttempt> = {},
): QuizAttempt {
  return {
    id: quizAttemptIdSchema.parse(randomUUID()),
    quizId: quiz.id,
    lessonId: quiz.lessonId,
    learnerId,
    attemptNumber: 1,
    status: "open",
    quizVersion: quiz.version,
    seed: 4_294_967_295,
    shuffleQuestions: true,
    shuffleOptions: false,
    startedAt: new Date("2026-03-01T10:00:00Z"),
    expiresAt: null,
    closedAt: null,
    answers: null,
    questionResults: null,
    score: null,
    passed: null,
    ...overrides,
  };
}

export function anAssignment(
  course: Course,
  audience: AssignmentAudience,
  overrides: Partial<CourseAssignment> = {},
): CourseAssignment {
  return {
    id: assignmentIdSchema.parse(randomUUID()),
    courseId: course.id,
    audience,
    dueAt: null,
    assignedBy: learnerIdSchema.parse("admin-1"),
    createdAt: new Date("2026-04-01T09:00:00Z"),
    ...overrides,
  };
}

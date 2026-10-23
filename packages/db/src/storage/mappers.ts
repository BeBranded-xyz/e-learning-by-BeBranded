import { z } from "zod";
import type { Selectable } from "kysely";

import {
  accessRuleSchema,
  chapterSchema,
  completionRuleSchema,
  courseIdSchema,
  courseSchema,
  enrollmentIdSchema,
  learnerIdSchema,
  lessonSchema,
} from "@bebranded/elearning-core";
import type {
  AccessRule,
  Audience,
  Chapter,
  Course,
  Enrollment,
  LessonDetail,
  LessonProgress,
  LessonSummary,
} from "@bebranded/elearning-core";

import type {
  AccessRules,
  Chapters,
  Courses,
  Enrollments,
  LessonProgress as LessonProgressRow,
  Lessons,
} from "../database.gen.js";

// Rows are parsed on the way out: storage reads are a trust boundary too
// (languages/typescript, "Boundaries and validation").

const jsonObjectSchema = z.record(z.string(), z.json());

export function toCourse(row: Selectable<Courses>): Course {
  return courseSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    coverImageUrl: row.cover_image_url,
    status: row.status,
    publishedAt: row.published_at,
    completionRule: completionRuleSchema.parse(row.completion_rule),
    enrollmentMode: row.enrollment_mode,
    locale: row.locale,
    metadata: jsonObjectSchema.parse(row.metadata),
  });
}

export function toChapter(row: Selectable<Chapters>): Chapter {
  return chapterSchema.parse({
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    position: row.position,
    status: row.status,
  });
}

type LessonSummaryRow = Omit<
  Selectable<Lessons>,
  "content" | "settings" | "content_schema_version"
>;

export function toLessonSummary(row: LessonSummaryRow): LessonSummary {
  const lesson = lessonSchema.parse({
    id: row.id,
    chapterId: row.chapter_id,
    type: row.type,
    title: row.title,
    position: row.position,
    status: row.status,
    isRequired: row.is_required,
    estimatedMinutes: row.estimated_minutes,
  });
  return { ...lesson, courseId: courseIdSchema.parse(row.course_id) };
}

export function toLessonDetail(row: Selectable<Lessons>): LessonDetail {
  return {
    ...toLessonSummary(row),
    content: z.json().nullable().parse(row.content),
    contentSchemaVersion: row.content_schema_version,
    settings: jsonObjectSchema.parse(row.settings),
  };
}

export function toAudience(type: string, value: string | null): unknown {
  switch (type) {
    case "role":
      return { type, role: value };
    case "grade_min":
      return { type, grade: Number(value) };
    case "learner":
      return { type, learnerId: value };
    default:
      return { type };
  }
}

export function toAccessRule(row: Selectable<AccessRules>): AccessRule {
  return accessRuleSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    targetType: row.target_type,
    targetId: row.target_id,
    effect: row.effect,
    audience: toAudience(row.audience_type, row.audience_value),
  });
}

export function audienceColumns(audience: Audience): {
  audience_type: string;
  audience_value: string | null;
} {
  switch (audience.type) {
    case "everyone":
      return { audience_type: "everyone", audience_value: null };
    case "role":
      return { audience_type: "role", audience_value: audience.role };
    case "grade_min":
      return { audience_type: "grade_min", audience_value: String(audience.grade) };
    case "learner":
      return { audience_type: "learner", audience_value: audience.learnerId };
  }
}

const enrollmentSourceSchema = z.enum(["self", "assigned", "auto"]);
const progressStatusSchema = z.enum(["not_started", "in_progress", "completed"]);

export function toEnrollment(row: Selectable<Enrollments>): Enrollment {
  return {
    id: enrollmentIdSchema.parse(row.id),
    courseId: courseIdSchema.parse(row.course_id),
    learnerId: learnerIdSchema.parse(row.learner_id),
    source: enrollmentSourceSchema.parse(row.source),
    assignedBy: row.assigned_by === null ? null : learnerIdSchema.parse(row.assigned_by),
    dueAt: row.due_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    progress: z.coerce.number().min(0).max(1).parse(row.progress),
  };
}

export function toLessonProgress(row: Selectable<LessonProgressRow>): LessonProgress {
  return {
    lessonId: lessonSchema.shape.id.parse(row.lesson_id),
    learnerId: learnerIdSchema.parse(row.learner_id),
    courseId: courseIdSchema.parse(row.course_id),
    status: progressStatusSchema.parse(row.status),
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

import { z } from "zod";

import { chapterIdSchema, courseIdSchema, lessonIdSchema, tenantIdSchema } from "./ids.js";

export const courseStatusSchema = z.enum(["draft", "published", "archived"]);
export const chapterStatusSchema = z.enum(["draft", "published"]);
export const lessonStatusSchema = z.enum(["draft", "published"]);
export const lessonTypeSchema = z.enum(["text", "video", "quiz"]);
export const enrollmentModeSchema = z.enum(["self", "assignment_only"]);

export type CourseStatus = z.infer<typeof courseStatusSchema>;
export type ChapterStatus = z.infer<typeof chapterStatusSchema>;
export type LessonStatus = z.infer<typeof lessonStatusSchema>;
export type LessonType = z.infer<typeof lessonTypeSchema>;
export type EnrollmentMode = z.infer<typeof enrollmentModeSchema>;

/** Lowercase words separated by single hyphens, unique per tenant. */
export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and single hyphens");

export const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "Use a language tag such as en or fr-FR");

export const completionRuleSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("all_required_lessons") }),
]);
export type CompletionRule = z.infer<typeof completionRuleSchema>;

export const textLessonSettingsSchema = z.strictObject({
  requireScrollToEnd: z.boolean().default(false),
});
export type TextLessonSettings = z.infer<typeof textLessonSettingsSchema>;

const titleSchema = z.string().trim().min(1).max(200);
const httpsUrlSchema = z.url({ protocol: /^https$/ }).max(2048);

export const courseSchema = z.strictObject({
  id: courseIdSchema,
  tenantId: tenantIdSchema.nullable(),
  slug: slugSchema,
  title: titleSchema,
  summary: z.string().max(2000).nullable(),
  coverImageUrl: httpsUrlSchema.nullable(),
  status: courseStatusSchema,
  publishedAt: z.date().nullable(),
  completionRule: completionRuleSchema,
  enrollmentMode: enrollmentModeSchema,
  /** Learners may export the course and its lessons to PDF and Word (spec 10); off by default. */
  allowLearnerExport: z.boolean(),
  locale: localeSchema,
  metadata: z.record(z.string(), z.unknown()),
});
export type Course = z.infer<typeof courseSchema>;

export const chapterSchema = z.strictObject({
  id: chapterIdSchema,
  courseId: courseIdSchema,
  title: titleSchema,
  position: z.int().nonnegative(),
  status: chapterStatusSchema,
});
export type Chapter = z.infer<typeof chapterSchema>;

export const lessonSchema = z.strictObject({
  id: lessonIdSchema,
  chapterId: chapterIdSchema,
  type: lessonTypeSchema,
  title: titleSchema,
  position: z.int().nonnegative(),
  status: lessonStatusSchema,
  isRequired: z.boolean(),
  estimatedMinutes: z.int().positive().max(10_000).nullable(),
});
export type Lesson = z.infer<typeof lessonSchema>;

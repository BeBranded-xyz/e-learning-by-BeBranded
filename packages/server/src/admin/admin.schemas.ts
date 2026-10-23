import { z } from "zod";

import {
  chapterIdSchema,
  chapterStatusSchema,
  completionRuleSchema,
  courseIdSchema,
  courseStatusSchema,
  enrollmentModeSchema,
  learnerIdSchema,
  lessonIdSchema,
  lessonStatusSchema,
  lessonTypeSchema,
  localeSchema,
  slugSchema,
} from "@bebranded/elearning-core";

// Request bodies of the admin API (snake_case, unknown fields rejected).

const title = z.string().trim().min(1).max(200);
const position = z.int().min(0).max(100_000);
const metadata = z
  .record(z.string(), z.json())
  .refine((value) => JSON.stringify(value).length <= 10_000, "metadata is limited to 10 kB");

const courseFields = {
  slug: slugSchema,
  title,
  summary: z.string().max(2000).nullable(),
  cover_image_url: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable(),
  enrollment_mode: enrollmentModeSchema,
  locale: localeSchema,
  completion_rule: completionRuleSchema,
  metadata,
};

export const createCourseBody = z.strictObject({
  ...courseFields,
  summary: courseFields.summary.default(null),
  cover_image_url: courseFields.cover_image_url.default(null),
  enrollment_mode: courseFields.enrollment_mode.default("self"),
  locale: courseFields.locale.default("en"),
  completion_rule: courseFields.completion_rule.default({ type: "all_required_lessons" }),
  metadata: courseFields.metadata.default({}),
});

export const updateCourseBody = z
  .strictObject({ ...courseFields, status: courseStatusSchema })
  .partial();

export const createChapterBody = z.strictObject({
  course_id: courseIdSchema,
  title,
  position,
  status: chapterStatusSchema.default("draft"),
});

export const updateChapterBody = z
  .strictObject({ title, position, status: chapterStatusSchema })
  .partial();

const lessonFields = {
  title,
  position,
  is_required: z.boolean(),
  estimated_minutes: z.int().min(1).max(10_000).nullable(),
  /** Validated by validateLessonDocument after parsing (size, nesting, blocks). */
  content: z.unknown(),
  /** Validated against the lesson type after parsing (`parseLessonSettings`). */
  settings: z.record(z.string(), z.unknown()),
};

/** Text, video and quiz lessons; a quiz lesson gets its questions through `PUT /admin/lessons/:id/quiz`. */
export const createLessonBody = z.strictObject({
  chapter_id: chapterIdSchema,
  type: lessonTypeSchema.default("text"),
  ...lessonFields,
  status: lessonStatusSchema.default("draft"),
  is_required: lessonFields.is_required.default(true),
  estimated_minutes: lessonFields.estimated_minutes.default(null),
  content: lessonFields.content.default(null),
  settings: lessonFields.settings.default({}),
});

export const updateLessonBody = z
  .strictObject({ ...lessonFields, status: lessonStatusSchema })
  .partial();

const audienceBody = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("everyone") }),
  z.strictObject({ type: z.literal("role"), role: z.string().trim().min(1).max(100) }),
  z.strictObject({ type: z.literal("grade_min"), grade: z.int().min(0).max(1000) }),
  z.strictObject({ type: z.literal("learner"), learner_id: learnerIdSchema }),
]);

const ruleFields = { effect: z.enum(["allow", "deny"]), audience: audienceBody };

/** One variant per target type, so the target id keeps its branded type. */
/** Body of `POST /v1/admin/videos/uploads` (spec 06, "Upload"). */
export const createVideoUploadBody = z.strictObject({
  lesson_id: lessonIdSchema,
  /** Reserved against storage by the provider; uploads longer than this are refused. */
  max_duration_seconds: z.int().min(1).max(36_000).default(3_600),
});

export const createAccessRuleBody = z.discriminatedUnion("target_type", [
  z.strictObject({ target_type: z.literal("course"), target_id: courseIdSchema, ...ruleFields }),
  z.strictObject({ target_type: z.literal("chapter"), target_id: chapterIdSchema, ...ruleFields }),
  z.strictObject({ target_type: z.literal("lesson"), target_id: lessonIdSchema, ...ruleFields }),
]);

export type CreateAccessRuleBody = z.infer<typeof createAccessRuleBody>;

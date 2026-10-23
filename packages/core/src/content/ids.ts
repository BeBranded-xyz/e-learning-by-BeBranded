import { z } from "zod";

// Branded ids: a raw string never travels between layers (languages/typescript).
export const courseIdSchema = z.uuid().brand<"CourseId">();
export const chapterIdSchema = z.uuid().brand<"ChapterId">();
export const lessonIdSchema = z.uuid().brand<"LessonId">();
export const accessRuleIdSchema = z.uuid().brand<"AccessRuleId">();
export const enrollmentIdSchema = z.uuid().brand<"EnrollmentId">();
export const videoAssetIdSchema = z.uuid().brand<"VideoAssetId">();
export const quizIdSchema = z.uuid().brand<"QuizId">();
export const quizAttemptIdSchema = z.uuid().brand<"QuizAttemptId">();

export type CourseId = z.infer<typeof courseIdSchema>;
export type ChapterId = z.infer<typeof chapterIdSchema>;
export type LessonId = z.infer<typeof lessonIdSchema>;
export type AccessRuleId = z.infer<typeof accessRuleIdSchema>;
export type EnrollmentId = z.infer<typeof enrollmentIdSchema>;
export type VideoAssetId = z.infer<typeof videoAssetIdSchema>;
export type QuizId = z.infer<typeof quizIdSchema>;
export type QuizAttemptId = z.infer<typeof quizAttemptIdSchema>;

/** Opaque identifiers coming from the host product. */
export const learnerIdSchema = z.string().trim().min(1).max(255).brand<"LearnerId">();
export const tenantIdSchema = z.string().trim().min(1).max(255).brand<"TenantId">();

export type LearnerId = z.infer<typeof learnerIdSchema>;
export type TenantId = z.infer<typeof tenantIdSchema>;

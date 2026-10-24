import type { CourseId, LessonId } from "../content/ids.js";
import type { QuizAttempt } from "./quiz-storage.types.js";
import type { Enrollment, TenantScope } from "./storage.types.js";

/** Reads behind the admin reports (spec 04, section 8); always the tenant's own learners. */
export type ReportStorageReads = {
  /** Every enrollment of the tenant in one course, oldest first. */
  listCourseEnrollments(scope: TenantScope, courseId: CourseId): Promise<Enrollment[]>;
  /** The tenant's submitted and expired attempts on one quiz lesson, oldest first. */
  listClosedQuizAttempts(scope: TenantScope, lessonId: LessonId): Promise<QuizAttempt[]>;
};

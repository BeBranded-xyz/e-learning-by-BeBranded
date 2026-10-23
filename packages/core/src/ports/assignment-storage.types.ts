import type { AssignmentAudience } from "../access/access.schemas.js";
import type { AssignmentId, CourseId, LearnerId } from "../content/ids.js";
import type { Learner } from "../identity/learner.js";
import type { TenantScope } from "./storage.types.js";

/** A course assigned by an admin to a learner, a role or a minimum grade (spec 05). */
export type CourseAssignment = {
  readonly id: AssignmentId;
  readonly courseId: CourseId;
  readonly audience: AssignmentAudience;
  readonly dueAt: Date | null;
  readonly assignedBy: LearnerId;
  readonly createdAt: Date;
};

export type AssignmentStorageReads = {
  /** The tenant's assignments of one course, oldest first. */
  listCourseAssignments(scope: TenantScope, courseId: CourseId): Promise<CourseAssignment[]>;
  /**
   * The tenant's assignments that target the learner (by id, role or grade)
   * for a course the learner is not enrolled in yet.
   */
  listPendingAssignments(
    scope: TenantScope,
    learner: Pick<Learner, "learnerId" | "roles" | "grade">,
  ): Promise<CourseAssignment[]>;
};

export type AssignmentStorageWrites = {
  /**
   * Inserts the assignment, or updates the due date and `assignedBy` of the
   * tenant's existing assignment of the same course to the same audience.
   * Returns the stored assignment (with the existing id and `createdAt`).
   */
  saveCourseAssignment(scope: TenantScope, assignment: CourseAssignment): Promise<CourseAssignment>;
  /** False when missing or owned by another tenant. Enrollments it created are kept. */
  deleteCourseAssignment(scope: TenantScope, id: AssignmentId): Promise<boolean>;
};

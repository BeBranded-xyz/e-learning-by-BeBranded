import { canAccess, enrollmentIdSchema } from "@bebranded/elearning-core";
import type {
  CourseAssignment,
  EnrollmentSource,
  LearnerId,
  StorageTransaction,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { emit } from "./events.js";

type AssignedSource = Extract<EnrollmentSource, "assigned" | "auto">;

/**
 * Enrolls a learner from an assignment and emits `enrollment.assigned`
 * (spec 05). A direct (`assigned`) assignment also takes over an existing
 * enrollment, keeping its progress; an `auto` one never changes it.
 */
export async function enrollFromAssignment(
  tx: StorageTransaction,
  context: RequestContext,
  assignment: CourseAssignment,
  input: { learnerId: LearnerId; source: AssignedSource },
): Promise<void> {
  const fresh = {
    id: enrollmentIdSchema.parse(context.newId()),
    courseId: assignment.courseId,
    learnerId: input.learnerId,
    source: input.source,
    assignedBy: assignment.assignedBy,
    dueAt: assignment.dueAt,
    startedAt: null,
    completedAt: null,
    progress: 0,
  };
  const stored = await tx.lockOrCreateEnrollment(context.scope, fresh);
  if (stored.id !== fresh.id) {
    if (input.source === "auto") return;
    const { assignedBy, dueAt } = assignment;
    await tx.saveEnrollment(context.scope, { ...stored, source: "assigned", assignedBy, dueAt });
  }
  await emit(tx, context, "enrollment.assigned", {
    learnerId: input.learnerId,
    courseId: assignment.courseId,
    assignedBy: assignment.assignedBy,
    dueAt: assignment.dueAt?.toISOString() ?? null,
  });
}

/** Earliest due date first; no due date last; then the oldest assignment. */
function byDueDate(a: CourseAssignment, b: CourseAssignment): number {
  const due = (assignment: CourseAssignment) => assignment.dueAt?.getTime() ?? Infinity;
  return due(a) - due(b) || a.createdAt.getTime() - b.createdAt.getTime();
}

/** One assignment per course: the learner's own if any, else the most urgent one. */
function assignmentPerCourse(pending: readonly CourseAssignment[]): CourseAssignment[] {
  const sorted = [...pending].sort(
    (a, b) =>
      Number(b.audience.type === "learner") - Number(a.audience.type === "learner") ||
      byDueDate(a, b),
  );
  const perCourse = new Map<string, CourseAssignment>();
  for (const assignment of sorted) {
    if (!perCourse.has(assignment.courseId)) perCourse.set(assignment.courseId, assignment);
  }
  return [...perCourse.values()];
}

/**
 * Turns the learner's pending assignments into enrollments (spec 05:
 * "creates the enrollments on the learner's next visit"). Only for courses
 * the learner can access now; the others stay pending. Idempotent.
 */
export async function applyPendingAssignments(context: RequestContext): Promise<void> {
  const { storage, scope, learner } = context;
  const pending = await storage.listPendingAssignments(scope, learner);
  if (pending.length === 0) return;
  const chosen = assignmentPerCourse(pending);
  const [courses, rules] = await Promise.all([
    storage.listCourses(scope),
    storage.listAccessRules(
      scope,
      chosen.map((assignment) => assignment.courseId),
    ),
  ]);
  const accessible = new Set(
    courses
      .filter((course) => {
        const node = { id: course.id, published: course.status === "published" };
        return canAccess(learner, { course: node }, rules).allowed;
      })
      .map((course) => course.id),
  );
  const toEnroll = chosen.filter((assignment) => accessible.has(assignment.courseId));
  if (toEnroll.length === 0) return;
  await storage.transaction(async (tx) => {
    for (const assignment of toEnroll) {
      const source = assignment.audience.type === "learner" ? "assigned" : "auto";
      await enrollFromAssignment(tx, context, assignment, { learnerId: learner.learnerId, source });
    }
  });
}

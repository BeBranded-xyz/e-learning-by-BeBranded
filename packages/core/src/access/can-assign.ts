import { learnerIdSchema } from "../content/ids.js";
import type { CourseId } from "../content/ids.js";
import type { Learner } from "../identity/learner.js";
import type { AccessRule, AssignmentAudience, Audience } from "./access.schemas.js";
import { canAccess } from "./can-access.js";

// Stands for "any member of the role or grade": no learner rule names it.
const MEMBER_ID = learnerIdSchema.parse("assignment-audience-member");

/** A member of a role or grade audience with no other role and exactly the minimum grade. */
function representativeMember(audience: Exclude<AssignmentAudience, { type: "learner" }>): Learner {
  return {
    learnerId: MEMBER_ID,
    tenantId: null,
    roles: audience.type === "role" ? [audience.role] : [],
    grade: audience.type === "grade_min" ? audience.grade : null,
    isAdmin: false,
  };
}

/** Whether a rule may apply to a learner known only by id (roles and grade unknown). */
function mayMatchLearner(rule: Audience, learnerId: string): boolean {
  return rule.type !== "learner" || rule.learnerId === learnerId;
}

/** Whether a rule surely applies to a learner known only by id. */
function surelyMatchesLearner(rule: Audience, learnerId: string): boolean {
  return rule.type === "everyone" || (rule.type === "learner" && rule.learnerId === learnerId);
}

/**
 * Whether a course may be assigned to `audience` (spec 05: the back-office
 * refuses to assign a course to someone who cannot access it). Only the
 * course rules count, and the course is treated as published, so an admin
 * can assign a draft ahead of its publication.
 *
 * - A role or grade: its members with nothing else (no other role, the
 *   minimum grade) must be allowed.
 * - A learner: their roles and grade are unknown to the back-office, so the
 *   course is refused only when no rule could ever let them in. Access is
 *   checked again with the real identity before the enrollment is created.
 */
export function canAssign(
  audience: AssignmentAudience,
  courseId: CourseId,
  rules: readonly AccessRule[],
): boolean {
  const courseRules = rules.filter(
    (rule) => rule.targetType === "course" && rule.targetId === courseId,
  );
  if (audience.type !== "learner") {
    const member = representativeMember(audience);
    return canAccess(member, { course: { id: courseId, published: true } }, courseRules).allowed;
  }
  const { learnerId } = audience;
  const surelyDenied = courseRules.some(
    (rule) => rule.effect === "deny" && surelyMatchesLearner(rule.audience, learnerId),
  );
  const mayBeAllowed = courseRules.some(
    (rule) => rule.effect === "allow" && mayMatchLearner(rule.audience, learnerId),
  );
  return !surelyDenied && mayBeAllowed;
}

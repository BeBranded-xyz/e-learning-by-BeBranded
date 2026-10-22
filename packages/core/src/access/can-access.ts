import type { Learner } from "../identity/learner.js";
import type { AccessRule, AccessTargetType, Audience } from "./access.schemas.js";

/** One node of the path from the course down to the target (spec 05). */
export type ContentNode = {
  readonly id: string;
  readonly published: boolean;
};

export type ContentPath = {
  readonly course: ContentNode;
  readonly chapter?: ContentNode;
  readonly lesson?: ContentNode;
};

export type AccessDenialReason =
  "not_published" | "no_rule" | "denied_by_rule" | "no_matching_rule";

export type AccessDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly reason: AccessDenialReason };

type LevelOutcome = "allow" | "deny_by_rule" | "deny_no_match" | "inherit";

export function audienceMatches(audience: Audience, learner: Learner): boolean {
  switch (audience.type) {
    case "everyone":
      return true;
    case "role":
      return learner.roles.includes(audience.role);
    case "grade_min":
      return learner.grade !== null && learner.grade >= audience.grade;
    case "learner":
      return learner.learnerId === audience.learnerId;
  }
}

/**
 * Decision of one level. `deny` always wins; an `allow` must match; a level
 * with no rule, or with only non-matching `deny` rules, inherits its parent.
 */
function evaluateLevel(rules: readonly AccessRule[], learner: Learner): LevelOutcome {
  if (rules.length === 0) return "inherit";
  const matching = rules.filter((rule) => audienceMatches(rule.audience, learner));
  if (matching.some((rule) => rule.effect === "deny")) return "deny_by_rule";
  if (matching.some((rule) => rule.effect === "allow")) return "allow";
  return rules.some((rule) => rule.effect === "allow") ? "deny_no_match" : "inherit";
}

function rulesFor(
  rules: readonly AccessRule[],
  targetType: AccessTargetType,
  targetId: string,
): AccessRule[] {
  return rules.filter((rule) => rule.targetType === targetType && rule.targetId === targetId);
}

function toDecision(outcome: Exclude<LevelOutcome, "allow" | "inherit">): AccessDecision {
  return {
    allowed: false,
    reason: outcome === "deny_by_rule" ? "denied_by_rule" : "no_matching_rule",
  };
}

/**
 * Whether `learner` may see the last node of `path` (spec 05, "Evaluation
 * algorithm"). Pure: the caller loads the rules of every node of the path.
 */
export function canAccess(
  learner: Learner,
  path: ContentPath,
  rules: readonly AccessRule[],
): AccessDecision {
  const levels: [AccessTargetType, ContentNode][] = [["course", path.course]];
  if (path.chapter) levels.push(["chapter", path.chapter]);
  if (path.lesson) levels.push(["lesson", path.lesson]);

  if (levels.some(([, node]) => !node.published)) {
    return { allowed: false, reason: "not_published" };
  }

  let allowed = false;
  for (const [targetType, node] of levels) {
    const outcome = evaluateLevel(rulesFor(rules, targetType, node.id), learner);
    if (outcome === "deny_by_rule" || outcome === "deny_no_match") return toDecision(outcome);
    if (outcome === "allow") allowed = true;
    // A course needs an explicit allow; children inherit from their parent.
    if (targetType === "course" && !allowed) return { allowed: false, reason: "no_rule" };
  }
  return { allowed: true };
}

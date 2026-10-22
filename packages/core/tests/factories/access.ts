import type { AccessRule, Audience, Learner } from "../../src/index.js";
import { accessRuleIdSchema, learnerIdSchema } from "../../src/index.js";

let sequence = 0;

/** Deterministic UUIDs for tests: 00000000-0000-4000-8000-<counter>. */
export function testUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

export function aLearner(overrides: Partial<Learner> = {}): Learner {
  return {
    learnerId: learnerIdSchema.parse("learner-1"),
    tenantId: null,
    roles: [],
    grade: null,
    isAdmin: false,
    ...overrides,
  };
}

export function aRule(
  targetType: AccessRule["targetType"],
  targetId: string,
  effect: AccessRule["effect"],
  audience: Audience = { type: "everyone" },
): AccessRule {
  return {
    id: accessRuleIdSchema.parse(testUuid()),
    tenantId: null,
    targetType,
    targetId,
    effect,
    audience,
  };
}

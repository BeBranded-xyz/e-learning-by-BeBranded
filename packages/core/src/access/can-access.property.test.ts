import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { aLearner, aRule, testUuid } from "../../tests/factories/access.js";
import { canAccess } from "./can-access.js";
import type { AccessRule, Audience } from "./access.schemas.js";
import type { ContentPath } from "./can-access.js";

const ids = { course: testUuid(), chapter: testUuid(), lesson: testUuid() };
const coursePath: ContentPath = { course: { id: ids.course, published: true } };
const chapterPath: ContentPath = { ...coursePath, chapter: { id: ids.chapter, published: true } };
const path: ContentPath = { ...chapterPath, lesson: { id: ids.lesson, published: true } };

const roles = ["staff", "manager", "hr", "intern"];
const audienceArb: fc.Arbitrary<Audience> = fc.oneof(
  fc.constant({ type: "everyone" } as const),
  fc.constantFrom(...roles).map((role) => ({ type: "role", role }) as const),
  fc.integer({ min: 0, max: 5 }).map((grade) => ({ type: "grade_min", grade }) as const),
);
const ruleArb: fc.Arbitrary<AccessRule> = fc
  .tuple(
    fc.constantFrom<AccessRule["targetType"]>("course", "chapter", "lesson"),
    fc.constantFrom<AccessRule["effect"]>("allow", "deny"),
    audienceArb,
  )
  .map(([targetType, effect, audience]) => aRule(targetType, ids[targetType], effect, audience));
const learnerArb = fc
  .tuple(fc.subarray(roles), fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }))
  .map(([learnerRoles, grade]) => aLearner({ roles: learnerRoles, grade }));
const rulesArb = fc.array(ruleArb, { maxLength: 8 });

describe("canAccess properties", () => {
  it("a child is never visible when its parent is not", () => {
    fc.assert(
      fc.property(learnerArb, rulesArb, (learner, rules) => {
        const lessonDecision = canAccess(learner, path, rules);
        const chapterDecision = canAccess(learner, chapterPath, rules);
        const courseDecision = canAccess(learner, coursePath, rules);

        if (lessonDecision.allowed) expect(chapterDecision.allowed).toBe(true);
        if (chapterDecision.allowed) expect(courseDecision.allowed).toBe(true);
      }),
    );
  });

  it("adding a matching deny rule anywhere on the path never grants access", () => {
    fc.assert(
      fc.property(
        learnerArb,
        rulesArb,
        fc.constantFrom("course", "chapter", "lesson"),
        (learner, rules, level) => {
          const denied = canAccess(learner, path, [...rules, aRule(level, ids[level], "deny")]);

          expect(denied.allowed).toBe(false);
        },
      ),
    );
  });

  it("is deterministic and independent of rule order", () => {
    fc.assert(
      fc.property(learnerArb, rulesArb, (learner, rules) => {
        expect(canAccess(learner, path, [...rules].reverse())).toEqual(
          canAccess(learner, path, rules),
        );
      }),
    );
  });

  it("denies everything when the course has no allow rule", () => {
    fc.assert(
      fc.property(learnerArb, rulesArb, (learner, rules) => {
        const withoutCourseAllow = rules.filter(
          (rule) => !(rule.targetType === "course" && rule.effect === "allow"),
        );

        expect(canAccess(learner, path, withoutCourseAllow).allowed).toBe(false);
      }),
    );
  });
});

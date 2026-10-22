import { describe, expect, it } from "vitest";

import { aLearner, aRule, testUuid } from "../../tests/factories/access.js";
import { learnerIdSchema } from "../content/ids.js";
import { audienceMatches, canAccess } from "./can-access.js";
import type { ContentPath } from "./can-access.js";

const course = { id: testUuid(), published: true };
const chapter = { id: testUuid(), published: true };
const lesson = { id: testUuid(), published: true };
const fullPath: ContentPath = { course, chapter, lesson };
const everyone = aRule("course", course.id, "allow");

describe("audienceMatches", () => {
  const manager = aLearner({ roles: ["employee", "manager"], grade: 3 });

  it.each([
    ["everyone", { type: "everyone" } as const, true],
    ["a role the learner has", { type: "role", role: "manager" } as const, true],
    ["a role the learner lacks", { type: "role", role: "director" } as const, false],
    ["a grade at the minimum", { type: "grade_min", grade: 3 } as const, true],
    ["a grade below the learner's", { type: "grade_min", grade: 2 } as const, true],
    ["a grade above the learner's", { type: "grade_min", grade: 4 } as const, false],
  ])("%s", (_label, audience, expected) => {
    expect(audienceMatches(audience, manager)).toBe(expected);
  });

  it("never matches a grade audience for a learner without grade", () => {
    expect(audienceMatches({ type: "grade_min", grade: 0 }, aLearner({ grade: null }))).toBe(false);
  });

  it("matches a learner audience only for that learner", () => {
    const audience = { type: "learner", learnerId: learnerIdSchema.parse("learner-1") } as const;

    expect(audienceMatches(audience, aLearner())).toBe(true);
    expect(
      audienceMatches(audience, aLearner({ learnerId: learnerIdSchema.parse("learner-2") })),
    ).toBe(false);
  });
});

describe("canAccess", () => {
  it("denies a course with no rule at all (deny by default)", () => {
    expect(canAccess(aLearner(), { course }, [])).toEqual({ allowed: false, reason: "no_rule" });
  });

  it("allows a course with an everyone rule", () => {
    expect(canAccess(aLearner(), { course }, [everyone])).toEqual({ allowed: true });
  });

  it.each([
    ["course", { course: { ...course, published: false } }],
    ["chapter", { course, chapter: { ...chapter, published: false } }],
    ["lesson", { course, chapter, lesson: { ...lesson, published: false } }],
  ] as const)("hides content whose %s is not published", (_level, path) => {
    expect(canAccess(aLearner(), path, [everyone])).toEqual({
      allowed: false,
      reason: "not_published",
    });
  });

  it("lets a lesson with no rule inherit the course decision", () => {
    expect(canAccess(aLearner(), fullPath, [everyone])).toEqual({ allowed: true });
  });

  it("denies when a matching deny exists, even next to a matching allow", () => {
    const rules = [
      everyone,
      aRule("lesson", lesson.id, "allow"),
      aRule("lesson", lesson.id, "deny", { type: "role", role: "intern" }),
    ];

    expect(canAccess(aLearner({ roles: ["intern"] }), fullPath, rules)).toEqual({
      allowed: false,
      reason: "denied_by_rule",
    });
  });

  it("denies when allow rules exist at a level but none matches", () => {
    const rules = [everyone, aRule("chapter", chapter.id, "allow", { type: "role", role: "hr" })];

    expect(canAccess(aLearner({ roles: ["sales"] }), fullPath, rules)).toEqual({
      allowed: false,
      reason: "no_matching_rule",
    });
  });

  it("allows a restricted chapter for a learner in its audience", () => {
    const rules = [everyone, aRule("chapter", chapter.id, "allow", { type: "role", role: "hr" })];

    expect(canAccess(aLearner({ roles: ["hr"] }), fullPath, rules)).toEqual({ allowed: true });
  });

  it("inherits when a level only has deny rules that do not match", () => {
    const rules = [everyone, aRule("lesson", lesson.id, "deny", { type: "role", role: "intern" })];

    expect(canAccess(aLearner({ roles: ["staff"] }), fullPath, rules)).toEqual({ allowed: true });
  });

  it("denies a course that only has non-matching deny rules (no explicit allow)", () => {
    const rules = [aRule("course", course.id, "deny", { type: "role", role: "intern" })];

    expect(canAccess(aLearner(), { course }, rules)).toEqual({ allowed: false, reason: "no_rule" });
  });

  it("never lets a child grant access the course refuses", () => {
    const rules = [
      aRule("course", course.id, "allow", { type: "role", role: "manager" }),
      aRule("lesson", lesson.id, "allow"),
    ];

    expect(canAccess(aLearner({ roles: ["staff"] }), fullPath, rules)).toEqual({
      allowed: false,
      reason: "no_matching_rule",
    });
  });

  it("ignores rules that target other content", () => {
    const rules = [everyone, aRule("lesson", testUuid(), "deny")];

    expect(canAccess(aLearner(), fullPath, rules)).toEqual({ allowed: true });
  });

  it("does not confuse a chapter rule with a lesson rule on the same id", () => {
    const sharedId = testUuid();
    const path = { course, chapter: { id: sharedId, published: true } };
    const rules = [everyone, aRule("lesson", sharedId, "deny")];

    expect(canAccess(aLearner(), path, rules)).toEqual({ allowed: true });
  });
});

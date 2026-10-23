import { describe, expect, it } from "vitest";

import { aRule, testUuid } from "../../tests/factories/access.js";
import { courseIdSchema, learnerIdSchema } from "../content/ids.js";
import type { AssignmentAudience } from "./access.schemas.js";
import { canAssign } from "./can-assign.js";

const courseId = courseIdSchema.parse(testUuid());
const ada = learnerIdSchema.parse("ada");
const bob = learnerIdSchema.parse("bob");

const sales = { type: "role", role: "sales" } as const;
const managers = { type: "role", role: "manager" } as const;
const grade3 = { type: "grade_min", grade: 3 } as const;
const learnerAda = { type: "learner", learnerId: ada } as const;

const allow = (audience: Parameters<typeof aRule>[3]) =>
  aRule("course", courseId, "allow", audience);
const deny = (audience: Parameters<typeof aRule>[3]) => aRule("course", courseId, "deny", audience);

describe("canAssign to a role or a grade", () => {
  it.each<[string, AssignmentAudience, Parameters<typeof aRule>[3][], boolean]>([
    ["everyone allowed", sales, [{ type: "everyone" }], true],
    ["the role allowed", sales, [sales], true],
    ["another role allowed only", sales, [managers], false],
    ["a lower minimum grade allowed", grade3, [{ type: "grade_min", grade: 2 }], true],
    ["the same minimum grade allowed", grade3, [grade3], true],
    ["a higher minimum grade allowed only", grade3, [{ type: "grade_min", grade: 4 }], false],
    ["a role required from a grade audience", grade3, [managers], false],
    ["a grade required from a role audience", sales, [grade3], false],
  ])("%s", (_label, audience, allowed, expected) => {
    expect(canAssign(audience, courseId, allowed.map(allow))).toBe(expected);
  });

  it("refuses a course without rules: courses are denied by default", () => {
    expect(canAssign(sales, courseId, [])).toBe(false);
  });

  it("refuses when a deny rule matches the audience, even with everyone allowed", () => {
    const rules = [allow({ type: "everyone" }), deny(sales)];

    expect(canAssign(sales, courseId, rules)).toBe(false);
    expect(canAssign(managers, courseId, rules)).toBe(true);
  });

  it("ignores rules of other courses, chapters and lessons", () => {
    const otherCourse = aRule("course", testUuid(), "allow", sales);
    const chapterDeny = aRule("chapter", testUuid(), "deny", sales);

    expect(canAssign(sales, courseId, [otherCourse])).toBe(false);
    expect(canAssign(sales, courseId, [allow(sales), chapterDeny])).toBe(true);
  });
});

describe("canAssign to a learner, whose roles and grade are unknown", () => {
  it.each<[string, Parameters<typeof aRule>[3][], boolean]>([
    ["everyone allowed", [{ type: "everyone" }], true],
    ["the learner allowed", [learnerAda], true],
    ["a role allowed: the learner may have it", [managers], true],
    ["a grade allowed: the learner may have it", [grade3], true],
    ["another learner allowed only", [{ type: "learner", learnerId: bob }], false],
  ])("%s", (_label, allowed, expected) => {
    expect(canAssign(learnerAda, courseId, allowed.map(allow))).toBe(expected);
  });

  it("refuses a course without allow rules", () => {
    expect(canAssign(learnerAda, courseId, [])).toBe(false);
    expect(canAssign(learnerAda, courseId, [deny(managers)])).toBe(false);
  });

  it("refuses when a deny rule surely matches the learner", () => {
    expect(canAssign(learnerAda, courseId, [allow(managers), deny(learnerAda)])).toBe(false);
    expect(canAssign(learnerAda, courseId, [allow(managers), deny({ type: "everyone" })])).toBe(
      false,
    );
  });

  it("accepts when a deny rule only may match the learner", () => {
    const rules = [
      allow({ type: "everyone" }),
      deny(sales),
      deny({ type: "learner", learnerId: bob }),
    ];

    expect(canAssign(learnerAda, courseId, rules)).toBe(true);
  });
});

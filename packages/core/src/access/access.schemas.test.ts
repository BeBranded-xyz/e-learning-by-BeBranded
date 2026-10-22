import { describe, expect, it } from "vitest";

import { testUuid } from "../../tests/factories/access.js";
import { accessRuleSchema, audienceSchema } from "./access.schemas.js";

describe("audienceSchema", () => {
  it.each([
    { type: "everyone" },
    { type: "role", role: "manager" },
    { type: "grade_min", grade: 3 },
    { type: "learner", learnerId: "user-1" },
  ])("accepts %j", (audience) => {
    expect(audienceSchema.safeParse(audience).success).toBe(true);
  });

  it.each([
    { type: "role" },
    { type: "role", role: "" },
    { type: "grade_min", grade: "3" },
    { type: "grade_min", grade: -1 },
    { type: "everyone", role: "manager" },
    { type: "group", group: "a" },
  ])("rejects %j", (audience) => {
    expect(audienceSchema.safeParse(audience).success).toBe(false);
  });
});

describe("accessRuleSchema", () => {
  const rule = {
    id: testUuid(),
    tenantId: null,
    targetType: "course",
    targetId: testUuid(),
    effect: "allow",
    audience: { type: "everyone" },
  };

  it("accepts a valid rule", () => {
    expect(accessRuleSchema.safeParse(rule).success).toBe(true);
  });

  it.each([
    ["an unknown effect", { effect: "maybe" }],
    ["an unknown target type", { targetType: "quiz" }],
    ["a non-uuid target", { targetId: "course-1" }],
  ])("rejects %s", (_label, override) => {
    expect(accessRuleSchema.safeParse({ ...rule, ...override }).success).toBe(false);
  });
});

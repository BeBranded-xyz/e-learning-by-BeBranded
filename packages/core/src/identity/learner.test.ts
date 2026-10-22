import { describe, expect, it } from "vitest";

import { learnerSchema } from "./learner.js";

const hostLearner = {
  learnerId: "user-1",
  tenantId: "company-1",
  roles: ["employee"],
  isAdmin: false,
};

describe("learnerSchema", () => {
  it("parses the host's learner and defaults grade to null", () => {
    expect(learnerSchema.parse(hostLearner)).toEqual({ ...hostLearner, grade: null });
  });

  it("keeps optional display name, grade and locale", () => {
    const parsed = learnerSchema.parse({
      ...hostLearner,
      grade: 3,
      displayName: "Ada",
      locale: "fr",
    });

    expect(parsed).toMatchObject({ grade: 3, displayName: "Ada", locale: "fr" });
  });

  it.each([
    ["a missing learnerId", { learnerId: undefined }],
    ["a non-boolean isAdmin", { isAdmin: "yes" }],
    ["a negative grade", { grade: -1 }],
    ["a fractional grade", { grade: 2.5 }],
    ["an empty role", { roles: [""] }],
    ["too many roles", { roles: Array.from({ length: 101 }, (_, index) => `role-${index}`) }],
    ["an unknown field", { email: "ada@example.com" }],
    ["an invalid locale", { locale: "French" }],
  ])("rejects %s", (_label, override) => {
    expect(learnerSchema.safeParse({ ...hostLearner, ...override }).success).toBe(false);
  });
});

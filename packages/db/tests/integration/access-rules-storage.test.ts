import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aCourse, anAllowRule, learner, tenantA, tenantB } from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

describe("access rules", () => {
  it("stores every audience type and reads it back", async () => {
    const course = aCourse(tenantA.tenantId);
    const base = anAllowRule(tenantA.tenantId, course);
    const rules = [
      base,
      {
        ...anAllowRule(tenantA.tenantId, course),
        effect: "deny" as const,
        audience: { type: "role" as const, role: "intern" },
      },
      {
        ...anAllowRule(tenantA.tenantId, course),
        audience: { type: "grade_min" as const, grade: 3 },
      },
      {
        ...anAllowRule(tenantA.tenantId, course),
        audience: { type: "learner" as const, learnerId: learner },
      },
    ];
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      for (const rule of rules) await tx.insertAccessRule(rule);
    });

    const stored = await database.storage.listAccessRules(tenantA, [course.id]);

    expect([...stored].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...rules].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(await database.storage.listAccessRules(tenantB, [course.id])).toEqual([]);
    expect(await database.storage.listAccessRules(tenantA, [])).toEqual([]);
  });

  it("finds a rule by id within the tenant only", async () => {
    const course = aCourse(tenantA.tenantId);
    const rule = anAllowRule(tenantA.tenantId, course);
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      await tx.insertAccessRule(rule);
    });

    expect(await database.storage.findAccessRule(tenantA, rule.id)).toEqual(rule);
    expect(await database.storage.findAccessRule(tenantB, rule.id)).toBeNull();
  });

  it("deletes only rules the tenant owns", async () => {
    const course = aCourse(tenantB.tenantId);
    const rule = anAllowRule(tenantB.tenantId, course);
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      await tx.insertAccessRule(rule);
    });

    expect(await database.storage.transaction((tx) => tx.deleteAccessRule(tenantA, rule.id))).toBe(
      false,
    );
    expect(await database.storage.transaction((tx) => tx.deleteAccessRule(tenantB, rule.id))).toBe(
      true,
    );
  });
});

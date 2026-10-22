import { randomUUID } from "node:crypto";

import { accessRuleIdSchema, learnerIdSchema, tenantIdSchema } from "@bebranded/elearning-core";
import type {
  AccessRule,
  Audience,
  Chapter,
  Course,
  LearnerInput,
  LessonDetail,
  TenantScope,
} from "@bebranded/elearning-core";

import { createTestDatabase } from "../../../db/tests/support/test-database.js";
import type { TestDatabase } from "../../../db/tests/support/test-database.js";
import { createElearning } from "../../src/index.js";
import type { ElearningOptions } from "../../src/index.js";

export const ORIGIN = "https://host.example.com";
const BASE = `${ORIGIN}/api/elearning`;

export const tenant = tenantIdSchema.parse("tenant-a");
const scope: TenantScope = { tenantId: tenant, includeShared: false };

/** Synthetic learners, addressed by a fake bearer token in tests. */
const learners = {
  staff: { learnerId: "staff-1", tenantId: tenant, roles: ["staff"], isAdmin: false },
  manager: {
    learnerId: "manager-1",
    tenantId: tenant,
    roles: ["staff", "manager"],
    grade: 3,
    isAdmin: false,
  },
  admin: { learnerId: "admin-1", tenantId: tenant, roles: ["training_admin"], isAdmin: true },
  otherTenant: { learnerId: "staff-9", tenantId: "tenant-b", roles: ["staff"], isAdmin: false },
} satisfies Record<string, LearnerInput>;

export type LearnerName = keyof typeof learners;

type Logged = {
  level: "warn" | "error";
  message: string;
  meta: Record<string, unknown> | undefined;
};

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

export async function createTestApp(overrides: Partial<ElearningOptions> = {}) {
  const database: TestDatabase = await createTestDatabase();
  const logs: Logged[] = [];
  const identityCalls: string[] = [];
  let now = new Date("2026-06-01T09:00:00Z");
  const app = createElearning({
    storage: database.storage,
    identity: (request) => {
      const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
      identityCalls.push(token);
      return Promise.resolve(token in learners ? learners[token as LearnerName] : null);
    },
    clock: () => now,
    logger: {
      warn: (message, meta) => logs.push({ level: "warn", message, meta }),
      error: (message, meta) => logs.push({ level: "error", message, meta }),
    },
    ...overrides,
  });
  return {
    app,
    database,
    logs,
    identityCalls,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    request: (
      method: string,
      path: string,
      options: { as?: LearnerName; headers?: Record<string, string>; body?: unknown } = {},
    ) =>
      app.handle(
        new Request(`${BASE}${path}`, {
          method,
          headers: {
            ...(options.as === undefined ? {} : { authorization: `Bearer ${options.as}` }),
            ...(options.body === undefined ? {} : { "content-type": "application/json" }),
            ...options.headers,
          },
          body: options.body === undefined ? null : JSON.stringify(options.body),
        }),
      ),
  };
}

export async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

export function rule(
  target: { id: string },
  targetType: AccessRule["targetType"],
  effect: AccessRule["effect"],
  audience: Audience = { type: "everyone" },
): AccessRule {
  return {
    id: accessRuleIdSchema.parse(randomUUID()),
    tenantId: tenant,
    targetType,
    targetId: target.id,
    effect,
    audience,
  };
}

export function learnerAudience(name: LearnerName): Audience {
  return { type: "learner", learnerId: learnerIdSchema.parse(learners[name].learnerId) };
}

export type Seed = {
  course: Course;
  chapters?: Chapter[];
  lessons?: LessonDetail[];
  rules?: AccessRule[];
};

export async function seed(database: TestDatabase, entries: Seed[]): Promise<void> {
  await database.storage.transaction(async (tx) => {
    for (const entry of entries) {
      await tx.insertCourse(entry.course);
      for (const chapter of entry.chapters ?? []) await tx.insertChapter(scope, chapter);
      for (const lesson of entry.lessons ?? []) await tx.insertLesson(scope, lesson);
      for (const accessRule of entry.rules ?? []) await tx.insertAccessRule(accessRule);
    }
  });
}

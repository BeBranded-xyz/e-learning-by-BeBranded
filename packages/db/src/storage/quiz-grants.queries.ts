import type { Kysely, Selectable } from "kysely";

import { attemptGrantIdSchema, learnerIdSchema, lessonIdSchema } from "@bebranded/elearning-core";
import type { LearnerId, LessonId, QuizAttemptGrant, TenantScope } from "@bebranded/elearning-core";

import type { DB, QuizAttemptGrants } from "../database.gen.js";
import { ownedBy } from "./tenant-filters.js";

// Grants belong to the admin's own tenant, like the learners they serve.

function toGrant(row: Selectable<QuizAttemptGrants>): QuizAttemptGrant {
  return {
    id: attemptGrantIdSchema.parse(row.id),
    lessonId: lessonIdSchema.parse(row.lesson_id),
    learnerId: learnerIdSchema.parse(row.learner_id),
    extraAttempts: row.extra_attempts,
    grantedBy: learnerIdSchema.parse(row.granted_by),
    createdAt: row.created_at,
  };
}

export async function listQuizAttemptGrants(
  db: Kysely<DB>,
  scope: TenantScope,
  lessonId: LessonId,
  learnerId?: LearnerId,
): Promise<QuizAttemptGrant[]> {
  let query = db
    .selectFrom("quiz_attempt_grants")
    .selectAll()
    .where("lesson_id", "=", lessonId)
    .where(ownedBy("quiz_attempt_grants.tenant_id", scope));
  if (learnerId !== undefined) query = query.where("learner_id", "=", learnerId);
  const rows = await query.orderBy("created_at").orderBy("id").execute();
  return rows.map(toGrant);
}

/** The attempts granted to one learner on one lesson, summed. */
export async function sumExtraAttempts(
  db: Kysely<DB>,
  scope: TenantScope,
  key: { learnerId: LearnerId; lessonId: LessonId },
): Promise<number> {
  const row = await db
    .selectFrom("quiz_attempt_grants")
    .select((eb) => eb.fn.coalesce(eb.fn.sum<string>("extra_attempts"), eb.lit(0)).as("total"))
    .where("lesson_id", "=", key.lessonId)
    .where("learner_id", "=", key.learnerId)
    .where(ownedBy("quiz_attempt_grants.tenant_id", scope))
    .executeTakeFirstOrThrow();
  return Number(row.total);
}

export async function insertQuizAttemptGrant(
  db: Kysely<DB>,
  scope: TenantScope,
  grant: QuizAttemptGrant,
): Promise<void> {
  await db
    .insertInto("quiz_attempt_grants")
    .values({
      id: grant.id,
      tenant_id: scope.tenantId,
      lesson_id: grant.lessonId,
      learner_id: grant.learnerId,
      extra_attempts: grant.extraAttempts,
      granted_by: grant.grantedBy,
      created_at: grant.createdAt,
    })
    .execute();
}

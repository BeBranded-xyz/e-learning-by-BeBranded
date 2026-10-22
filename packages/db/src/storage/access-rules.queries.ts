import type { Kysely } from "kysely";

import type { AccessRule, AccessRuleId, TenantScope } from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { audienceColumns, toAccessRule } from "./mappers.js";
import { ownedBy, readableContent } from "./tenant-filters.js";

export async function listAccessRules(
  db: Kysely<DB>,
  scope: TenantScope,
  targetIds: readonly string[],
): Promise<AccessRule[]> {
  if (targetIds.length === 0) return [];
  const rows = await db
    .selectFrom("access_rules")
    .selectAll()
    .where("target_id", "in", targetIds)
    .where(readableContent("access_rules.tenant_id", scope))
    .orderBy("id")
    .execute();
  return rows.map(toAccessRule);
}

export async function findAccessRule(
  db: Kysely<DB>,
  scope: TenantScope,
  id: AccessRuleId,
): Promise<AccessRule | null> {
  const row = await db
    .selectFrom("access_rules")
    .selectAll()
    .where("id", "=", id)
    .where(readableContent("access_rules.tenant_id", scope))
    .executeTakeFirst();
  return row === undefined ? null : toAccessRule(row);
}

export async function insertAccessRule(db: Kysely<DB>, rule: AccessRule): Promise<void> {
  await db
    .insertInto("access_rules")
    .values({
      id: rule.id,
      tenant_id: rule.tenantId,
      target_type: rule.targetType,
      target_id: rule.targetId,
      effect: rule.effect,
      ...audienceColumns(rule.audience),
    })
    .execute();
}

export async function deleteAccessRule(
  db: Kysely<DB>,
  scope: TenantScope,
  id: AccessRuleId,
): Promise<boolean> {
  const result = await db
    .deleteFrom("access_rules")
    .where("id", "=", id)
    .where(ownedBy("tenant_id", scope))
    .executeTakeFirst();
  return result.numDeletedRows > 0n;
}

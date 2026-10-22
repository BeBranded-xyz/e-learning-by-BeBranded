import { sql } from "kysely";
import type { RawBuilder } from "kysely";

import type { TenantScope } from "@bebranded/elearning-core";

/**
 * Tenant isolation lives here, in the storage layer (spec 05). Column names
 * are constants from this package; tenant values are always bound parameters.
 */

/** Content reads: the tenant's own rows, plus the shared catalog when enabled. */
export function readableContent(column: string, scope: TenantScope): RawBuilder<boolean> {
  const ref = sql.ref(column);
  if (scope.tenantId === null) return sql<boolean>`${ref} IS NULL`;
  if (scope.includeShared) return sql<boolean>`(${ref} = ${scope.tenantId} OR ${ref} IS NULL)`;
  return sql<boolean>`${ref} = ${scope.tenantId}`;
}

/** Writes, and learner data: only rows owned by the tenant itself. */
export function ownedBy(column: string, scope: TenantScope): RawBuilder<boolean> {
  const ref = sql.ref(column);
  return scope.tenantId === null
    ? sql<boolean>`${ref} IS NULL`
    : sql<boolean>`${ref} = ${scope.tenantId}`;
}

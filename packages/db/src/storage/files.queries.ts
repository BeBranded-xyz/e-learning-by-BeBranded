import type { Kysely, Selectable } from "kysely";

import { fileIdSchema, learnerIdSchema } from "@bebranded/elearning-core";
import type { FileId, StoredFile, TenantScope } from "@bebranded/elearning-core";

import type { DB, Files } from "../database.gen.js";
import { readableContent } from "./tenant-filters.js";

function toStoredFile(row: Selectable<Files>): StoredFile {
  return {
    id: fileIdSchema.parse(row.id),
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    uploadedBy: learnerIdSchema.parse(row.uploaded_by),
    createdAt: row.created_at,
  };
}

// Files follow the content they illustrate: shared-catalog lessons use shared files.
export async function findFiles(
  db: Kysely<DB>,
  scope: TenantScope,
  ids: readonly FileId[],
): Promise<StoredFile[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .selectFrom("files")
    .selectAll()
    .where("id", "in", ids)
    .where(readableContent("files.tenant_id", scope))
    .execute();
  return rows.map(toStoredFile);
}

export async function insertFile(
  db: Kysely<DB>,
  scope: TenantScope,
  file: StoredFile,
): Promise<void> {
  await db
    .insertInto("files")
    .values({
      id: file.id,
      tenant_id: scope.tenantId,
      storage_key: file.storageKey,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      uploaded_by: file.uploadedBy,
      created_at: file.createdAt,
    })
    .execute();
}

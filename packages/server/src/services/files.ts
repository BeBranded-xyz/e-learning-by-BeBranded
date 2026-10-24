import { AppError, collectFileIds } from "@bebranded/elearning-core";
import type { FileId, FileStorage, LessonBlock, TenantScope } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";

/** Signed read URLs outlive a lesson page view comfortably. */
export const FILE_READ_TTL_SECONDS = 60 * 60;

export type FileUrlResolver = (id: FileId) => string | undefined;

const noFiles: FileUrlResolver = () => undefined;

export function requireFileStorage(context: RequestContext): FileStorage {
  const storage = context.options.files;
  if (storage !== null) return storage;
  throw new AppError(
    "internal",
    "file_storage_not_configured",
    "File uploads need a file storage in the module configuration.",
  );
}

/** Admins only reference their own tenant's files, even from shared content. */
function ownScope(context: RequestContext): TenantScope {
  return { tenantId: context.scope.tenantId, includeShared: false };
}

/**
 * Refuses a document that points to a file the admin's tenant did not
 * upload (missing, deleted or another tenant's), before it is stored.
 */
export async function assertFilesExist(
  context: RequestContext,
  blocks: readonly LessonBlock[],
): Promise<void> {
  const ids = collectFileIds(blocks);
  if (ids.length === 0) return;
  const known = new Set(
    (await context.storage.findFiles(ownScope(context), ids)).map((file) => file.id),
  );
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length === 0) return;
  throw new AppError("validation", "invalid_content", "The content points to unknown files.", {
    details: {
      issues: unknown.slice(0, 20).map((id) => ({
        code: "unknown_file",
        path: "",
        message: `File ${id} was not uploaded through the module`,
      })),
    },
  });
}

/**
 * Signed URLs for the files of the blocks the learner is about to read.
 * Best effort per file: a storage failure only hides that file, so the
 * lesson still renders, and it is logged.
 */
export async function resolveFileUrls(
  context: RequestContext,
  blocks: readonly LessonBlock[],
): Promise<FileUrlResolver> {
  const storage = context.options.files;
  const ids = collectFileIds(blocks);
  if (storage === null || ids.length === 0) return noFiles;
  const files = await context.storage.findFiles(context.scope, ids);
  const entries = await Promise.all(
    files.map(async (file) => {
      try {
        const url = await storage.getReadUrl(file.storageKey, {
          ttlSeconds: FILE_READ_TTL_SECONDS,
        });
        return [file.id, url] as const;
      } catch (error) {
        context.logger.warn("file read url could not be created", {
          requestId: context.requestId,
          fileId: file.id,
          error,
        });
        return null;
      }
    }),
  );
  const urls = new Map(entries.filter((entry) => entry !== null));
  return (id) => urls.get(id);
}

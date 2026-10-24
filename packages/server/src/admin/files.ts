import { z } from "zod";

import { AppError, fileIdSchema, fileUrl, learnerIdSchema } from "@bebranded/elearning-core";
import type { StoredFile } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { FILE_READ_TTL_SECONDS, requireFileStorage } from "../services/files.js";
import { found, parseId } from "./ids.js";
import { parseBody } from "./parse-body.js";

const createFileUploadBody = z.strictObject({
  mime_type: z.string().trim().toLowerCase().max(255),
  size_bytes: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
});

function presentFile(file: StoredFile) {
  return {
    id: file.id,
    url: fileUrl(file.id),
    mime_type: file.mimeType,
    size_bytes: file.sizeBytes,
    created_at: file.createdAt.toISOString(),
  };
}

function assertAllowed(context: RequestContext, mimeType: string, sizeBytes: number): void {
  const { mimeTypes, maxBytes } = context.options.fileUploads;
  if (!mimeTypes.includes(mimeType)) {
    throw new AppError("validation", "file_type_not_allowed", "This type of file is not allowed.", {
      details: { allowed: mimeTypes },
    });
  }
  if (sizeBytes > maxBytes) {
    throw new AppError("validation", "file_too_large", "This file is too large.", {
      details: { max_bytes: maxBytes },
    });
  }
}

/**
 * POST /v1/admin/files/uploads: an upload URL for an editor image or
 * attachment (spec 04, section 4). The type and size are checked before the
 * host's storage is asked; the browser then PUTs the file to `upload.url`.
 */
export async function createFileUpload(context: RequestContext): Promise<Response> {
  const body = await parseBody(context, createFileUploadBody);
  assertAllowed(context, body.mime_type, body.size_bytes);
  const storage = requireFileStorage(context);
  const upload = await storage.createUpload({
    tenantId: context.scope.tenantId,
    mimeType: body.mime_type,
    sizeBytes: body.size_bytes,
  });
  const file: StoredFile = {
    id: fileIdSchema.parse(context.newId()),
    storageKey: upload.key,
    mimeType: body.mime_type,
    sizeBytes: body.size_bytes,
    uploadedBy: learnerIdSchema.parse(context.learner.learnerId),
    createdAt: context.now(),
  };
  await context.storage.transaction((tx) => tx.insertFile(context.scope, file));
  return json(
    {
      file: presentFile(file),
      upload: { url: upload.uploadUrl, method: "PUT", headers: { "Content-Type": file.mimeType } },
    },
    context.requestId,
    201,
  );
}

/** GET /v1/admin/files/:id: a signed read URL, so the editor can show an uploaded image. */
export async function getAdminFile(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(fileIdSchema, rawId);
  const storage = requireFileStorage(context);
  const [file] = await context.storage.findFiles(context.scope, [id]);
  const stored = found(file);
  const readUrl = await storage.getReadUrl(stored.storageKey, {
    ttlSeconds: FILE_READ_TTL_SECONDS,
  });
  const expiresAt = new Date(context.now().getTime() + FILE_READ_TTL_SECONDS * 1000);
  return json(
    { ...presentFile(stored), read_url: readUrl, read_url_expires_at: expiresAt.toISOString() },
    context.requestId,
  );
}

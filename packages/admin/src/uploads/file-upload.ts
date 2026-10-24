import { fileIdFromUrl } from "@bebranded/elearning-core";
import type { Fetcher } from "@bebranded/elearning-react";

import type { AdminClient } from "../api/admin-client.js";

/** The storage refused the bytes (spec 04, section 4); the file row stays unused. */
export class UploadFailedError extends Error {
  constructor(readonly status: number) {
    super(`The file storage answered ${status}.`);
    this.name = "UploadFailedError";
  }
}

/**
 * BlockNote's `uploadFile`: asks the module for an upload URL (type and
 * size checked by the server), PUTs the bytes to the host's storage, and
 * answers the url the document stores (`elearning-file:<id>`).
 */
export async function uploadEditorFile(
  admin: AdminClient,
  upload: Fetcher,
  file: File,
): Promise<string> {
  const { file: stored, upload: target } = await admin.createFileUpload({
    mime_type: file.type,
    size_bytes: file.size,
  });
  const response = await upload(target.url, {
    method: target.method,
    headers: target.headers,
    body: file,
  });
  if (!response.ok) throw new UploadFailedError(response.status);
  return stored.url;
}

/** BlockNote's `resolveFileUrl`: an uploaded file's short-lived signed URL, for display. */
export async function resolveEditorFileUrl(admin: AdminClient, url: string): Promise<string> {
  const id = fileIdFromUrl(url);
  if (id === null) return url;
  return (await admin.getFile(id)).read_url;
}

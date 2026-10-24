import type { Fetcher } from "@bebranded/elearning-react";

import type { AdminClient } from "../api/admin-client.js";
import { UploadFailedError } from "./file-upload.js";
import { tusUpload } from "./tus-upload.js";

export type VideoUploadOptions = {
  readonly admin: AdminClient;
  readonly upload: Fetcher;
  readonly lessonId: string;
  readonly onProgress?: (ratio: number) => void;
  readonly signal?: AbortSignal;
};

/**
 * Sends a video straight to the provider (spec 06, "Upload"): the server
 * creates a one-time URL, then the browser posts the file (up to 200 MB)
 * or uploads it with tus in resumable chunks. The provider's webhook then
 * marks the video ready.
 */
export async function uploadVideo(file: File, options: VideoUploadOptions): Promise<void> {
  const { admin, upload, lessonId, onProgress, signal } = options;
  const created = await admin.createVideoUpload({ lesson_id: lessonId, size_bytes: file.size });
  if (created.upload_protocol === "tus") {
    await tusUpload(created.upload_url, file, {
      fetcher: upload,
      onProgress: (sent) => onProgress?.(sent / file.size),
      ...(signal === undefined ? {} : { signal }),
    });
    return;
  }
  const form = new FormData();
  form.append("file", file);
  const response = await upload(created.upload_url, {
    method: "POST",
    body: form,
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) throw new UploadFailedError(response.status);
  onProgress?.(1);
}

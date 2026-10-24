import { z } from "zod";

import type { DirectUpload } from "@bebranded/elearning-core";

import { send, upstream } from "./api.js";
import type { CloudflareStreamConfig } from "./config.js";

/** Above this size, the basic direct upload is refused by Stream: use tus. */
export const BASIC_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;

const base64 = (value: string) => btoa(value);

const locationSchema = z.url({ protocol: /^https$/ });
const uidSchema = z.string().regex(/^[0-9a-f]{32}$/);

/**
 * Creates a resumable direct creator upload (Stream's tus endpoint with
 * `direct_user=true`): the answer's `Location` is a one-time tus URL the
 * browser uploads to without the API token; `stream-media-id` is the video.
 */
export async function createTusUpload(
  config: CloudflareStreamConfig,
  input: { readonly sizeBytes: number; readonly maxDurationSeconds: number },
): Promise<DirectUpload> {
  const response = await send(config, {
    method: "POST",
    path: "?direct_user=true",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(input.sizeBytes),
      "Upload-Metadata": `maxdurationseconds ${base64(String(Math.ceil(input.maxDurationSeconds)))},requiresignedurls`,
    },
  });
  const location = locationSchema.safeParse(response.headers.get("location"));
  const uid = uidSchema.safeParse(response.headers.get("stream-media-id"));
  if (!response.ok || !location.success || !uid.success) {
    throw upstream(
      "video_provider_error",
      `Cloudflare Stream answered ${response.status} to POST /?direct_user=true.`,
    );
  }
  return { uploadUrl: location.data, assetId: uid.data, protocol: "tus" };
}

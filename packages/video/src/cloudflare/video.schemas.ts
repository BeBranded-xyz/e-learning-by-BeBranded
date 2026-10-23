import { z } from "zod";

import type { VideoAssetSnapshot } from "@bebranded/elearning-core";

// Shapes from https://developers.cloudflare.com/api/resources/stream/ and the
// webhook guide. Only the fields the adapter reads are declared; unknown
// fields are allowed because Cloudflare adds fields over time.

export const envelopeSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({ code: z.number().optional(), message: z.string() })).default([]),
  result: z.unknown(),
});

export const directUploadSchema = z.object({
  uid: z.string().min(1).max(64),
  uploadURL: z.url({ protocol: /^https$/ }),
});

const streamStateSchema = z.enum([
  "pendingupload",
  "downloading",
  "queued",
  "inprogress",
  "ready",
  "error",
  "live-inprogress",
]);

export const streamVideoSchema = z.object({
  uid: z.string().min(1).max(64),
  readyToStream: z.boolean().default(false),
  status: z.object({ state: streamStateSchema }),
  /** Seconds; `-1` while unknown. */
  duration: z.number().optional(),
  /** Omitted until encoding is complete. */
  thumbnail: z.url().optional(),
});
export type StreamVideo = z.infer<typeof streamVideoSchema>;

function toStatus(video: StreamVideo): VideoAssetSnapshot["status"] {
  switch (video.status.state) {
    case "pendingupload":
      return "uploading";
    case "ready":
      return video.readyToStream ? "ready" : "processing";
    case "error":
      return "error";
    case "downloading":
    case "queued":
    case "inprogress":
    case "live-inprogress":
      return "processing";
  }
}

/** Maps a Stream video object to the module's view of an asset. */
export function toSnapshot(video: StreamVideo): VideoAssetSnapshot {
  const status = toStatus(video);
  const duration = video.duration !== undefined && video.duration > 0 ? video.duration : null;
  // A ready asset must have a duration (spec 03); without one it is still processing.
  return {
    status: status === "ready" && duration === null ? "processing" : status,
    durationSeconds: duration,
    thumbnailUrl: video.thumbnail ?? null,
  };
}

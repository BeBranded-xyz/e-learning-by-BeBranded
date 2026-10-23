import { z } from "zod";

/** Longest video the module tracks (Cloudflare's own maximum is 10 hours). */
const MAX_SECONDS = 36_000;
const seconds = z.number().min(0).max(MAX_SECONDS);

/** Body of `POST /v1/lessons/:id/video-progress` (spec 06, "Client side"). */
export const videoHeartbeatBody = z.strictObject({
  session_id: z.uuid(),
  seq: z.int().min(0).max(1_000_000),
  ranges: z
    .array(
      z
        .tuple([seconds, seconds])
        .refine(([start, end]) => end >= start, "A range must end after it starts"),
    )
    .max(100),
  position: seconds,
  /** Reported by the player for diagnostics; the lesson's `maxPlaybackRate` is what counts. */
  playback_rate: z.number().min(0.0625).max(16),
});

export const VIDEO_HEARTBEAT_MAX_BYTES = 8_192;

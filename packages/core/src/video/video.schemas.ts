import { z } from "zod";

/** A played interval, in seconds from the start of the video: `[start, end]`. */
export type WatchedRange = readonly [start: number, end: number];

export const videoAssetStatusSchema = z.enum(["uploading", "processing", "ready", "error"]);
export type VideoAssetStatus = z.infer<typeof videoAssetStatusSchema>;

/** Per-lesson options of a video lesson (spec 06, "Per-lesson options"). */
export const videoLessonSettingsSchema = z.strictObject({
  completionThreshold: z.number().min(0.5).max(1).default(0.95),
  allowSeeking: z.boolean().default(true),
  maxPlaybackRate: z.number().min(1).max(4).default(2),
  pauseWhenHidden: z.boolean().default(false),
});
export type VideoLessonSettings = z.infer<typeof videoLessonSettingsSchema>;

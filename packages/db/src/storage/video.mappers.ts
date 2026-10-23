import { z } from "zod";
import type { Selectable } from "kysely";

import {
  lessonIdSchema,
  videoAssetIdSchema,
  videoAssetStatusSchema,
} from "@bebranded/elearning-core";
import type {
  LearnerId,
  LessonId,
  VideoAsset,
  VideoProgress,
  WatchedRange,
} from "@bebranded/elearning-core";

import type { VideoAssets, VideoProgress as VideoProgressRow } from "../database.gen.js";

// pg returns numeric columns as strings; they are parsed back to numbers here.
const numberSchema = z.coerce.number().pipe(z.number());
const captionsSchema = z.array(z.strictObject({ lang: z.string(), url: z.string() }));
const rangesSchema = z.array(z.tuple([z.number(), z.number()]));

export function toVideoAsset(row: Selectable<VideoAssets>): VideoAsset {
  return {
    id: videoAssetIdSchema.parse(row.id),
    lessonId: lessonIdSchema.parse(row.lesson_id),
    provider: row.provider,
    providerAssetId: row.provider_asset_id,
    status: videoAssetStatusSchema.parse(row.status),
    durationSeconds:
      row.duration_seconds === null ? null : numberSchema.parse(row.duration_seconds),
    thumbnailUrl: row.thumbnail_url,
    captions: captionsSchema.parse(row.captions),
  };
}

export function toVideoProgress(
  row: Selectable<VideoProgressRow>,
  key: { learnerId: LearnerId; lessonId: LessonId },
): VideoProgress {
  return {
    lessonId: key.lessonId,
    learnerId: key.learnerId,
    watchedRanges: rangesSchema.parse(row.watched_ranges) satisfies WatchedRange[],
    watchedSeconds: numberSchema.parse(row.watched_seconds),
    coverage: numberSchema.parse(row.coverage),
    lastPosition: numberSchema.parse(row.last_position),
    lastHeartbeatAt: row.last_heartbeat_at,
    suspiciousEvents: row.suspicious_events,
  };
}

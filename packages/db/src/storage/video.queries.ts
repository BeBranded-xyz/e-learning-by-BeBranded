import type { Kysely } from "kysely";

import type {
  LearnerId,
  LessonId,
  TenantScope,
  VideoAsset,
  VideoHeartbeatKey,
  VideoProgress,
  VideoWebhookEvent,
} from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { insertedAny } from "./patch.js";
import { ownedBy, readableContent } from "./tenant-filters.js";
import { toVideoAsset, toVideoProgress } from "./video.mappers.js";

type LearnerLesson = { learnerId: LearnerId; lessonId: LessonId };

/** The learner's lesson progress row: video progress and sessions hang off it. */
function lessonProgress(db: Kysely<DB>, scope: TenantScope, key: LearnerLesson) {
  return db
    .selectFrom("lesson_progress")
    .where("lesson_progress.lesson_id", "=", key.lessonId)
    .where("lesson_progress.learner_id", "=", key.learnerId)
    .where(ownedBy("lesson_progress.tenant_id", scope));
}

export async function findVideoAsset(
  db: Kysely<DB>,
  scope: TenantScope,
  lessonId: LessonId,
): Promise<VideoAsset | null> {
  const row = await db
    .selectFrom("video_assets")
    .selectAll()
    .where("lesson_id", "=", lessonId)
    .where(readableContent("video_assets.tenant_id", scope))
    .executeTakeFirst();
  return row === undefined ? null : toVideoAsset(row);
}

export async function saveVideoAsset(
  db: Kysely<DB>,
  scope: TenantScope,
  asset: VideoAsset,
): Promise<boolean> {
  const replaced = {
    provider: asset.provider,
    provider_asset_id: asset.providerAssetId,
    status: asset.status,
    duration_seconds: asset.durationSeconds,
    thumbnail_url: asset.thumbnailUrl,
    captions: JSON.stringify(asset.captions),
  };
  const result = await db
    .insertInto("video_assets")
    .columns([
      "id",
      "tenant_id",
      "lesson_id",
      ...(Object.keys(replaced) as (keyof typeof replaced)[]),
    ])
    .expression(
      db
        .selectFrom("lessons")
        .select((eb) => [
          eb.val(asset.id).as("id"),
          "lessons.tenant_id",
          "lessons.id as lesson_id",
          eb.val(replaced.provider).as("provider"),
          eb.val(replaced.provider_asset_id).as("provider_asset_id"),
          eb.val(replaced.status).as("status"),
          eb.val(replaced.duration_seconds).as("duration_seconds"),
          eb.val(replaced.thumbnail_url).as("thumbnail_url"),
          eb.val(replaced.captions).as("captions"),
        ])
        .where("lessons.id", "=", asset.lessonId)
        .where(ownedBy("lessons.tenant_id", scope)),
    )
    .onConflict((oc) => oc.column("lesson_id").doUpdateSet(replaced))
    .executeTakeFirst();
  return insertedAny(result);
}

export async function applyVideoWebhook(
  db: Kysely<DB>,
  provider: string,
  event: VideoWebhookEvent,
): Promise<VideoAsset | null> {
  let query = db
    .updateTable("video_assets")
    .set({
      status: event.status,
      duration_seconds: event.durationSeconds,
      thumbnail_url: event.thumbnailUrl,
    })
    .where("provider", "=", provider)
    .where("provider_asset_id", "=", event.assetId);
  // Webhooks can arrive out of order: a late "processing" never hides a ready video.
  if (event.status === "uploading" || event.status === "processing")
    query = query.where("status", "<>", "ready");
  const row = await query.returningAll().executeTakeFirst();
  return row === undefined ? null : toVideoAsset(row);
}

export async function acceptVideoHeartbeat(
  db: Kysely<DB>,
  scope: TenantScope,
  key: VideoHeartbeatKey,
): Promise<boolean> {
  const row = await db
    .insertInto("video_sessions")
    .columns(["lesson_progress_id", "session_id", "tenant_id", "last_seq"])
    .expression(
      lessonProgress(db, scope, key).select((eb) => [
        "lesson_progress.id as lesson_progress_id",
        eb.val(key.sessionId).as("session_id"),
        "lesson_progress.tenant_id",
        eb.val(key.seq).as("last_seq"),
      ]),
    )
    .onConflict((oc) =>
      oc
        .columns(["lesson_progress_id", "session_id"])
        .doUpdateSet((eb) => ({ last_seq: eb.ref("excluded.last_seq") }))
        .where("video_sessions.last_seq", "<", (eb) => eb.ref("excluded.last_seq")),
    )
    .returning("session_id")
    .executeTakeFirst();
  return row !== undefined;
}

function progressQuery(db: Kysely<DB>, scope: TenantScope, key: LearnerLesson) {
  return db
    .selectFrom("video_progress")
    .selectAll()
    .where("lesson_progress_id", "in", lessonProgress(db, scope, key).select("lesson_progress.id"));
}

export async function findVideoProgress(
  db: Kysely<DB>,
  scope: TenantScope,
  key: LearnerLesson,
): Promise<VideoProgress | null> {
  const row = await progressQuery(db, scope, key).executeTakeFirst();
  return row === undefined ? null : toVideoProgress(row, key);
}

export async function lockOrCreateVideoProgress(
  db: Kysely<DB>,
  scope: TenantScope,
  key: LearnerLesson,
): Promise<VideoProgress | null> {
  await db
    .insertInto("video_progress")
    .columns(["lesson_progress_id", "tenant_id"])
    .expression(
      lessonProgress(db, scope, key).select(["lesson_progress.id", "lesson_progress.tenant_id"]),
    )
    .onConflict((oc) => oc.column("lesson_progress_id").doNothing())
    .execute();
  const row = await progressQuery(db, scope, key).forUpdate().executeTakeFirst();
  return row === undefined ? null : toVideoProgress(row, key);
}

export async function saveVideoProgress(
  db: Kysely<DB>,
  scope: TenantScope,
  progress: VideoProgress,
): Promise<void> {
  await db
    .updateTable("video_progress")
    .set({
      watched_ranges: JSON.stringify(progress.watchedRanges),
      watched_seconds: progress.watchedSeconds,
      coverage: progress.coverage,
      last_position: progress.lastPosition,
      last_heartbeat_at: progress.lastHeartbeatAt,
      suspicious_events: progress.suspiciousEvents,
    })
    .where(
      "lesson_progress_id",
      "in",
      lessonProgress(db, scope, progress).select("lesson_progress.id"),
    )
    .execute();
}

import { AppError, videoLessonSettingsSchema } from "@bebranded/elearning-core";
import type {
  LessonDetail,
  PlaybackSource,
  VideoAsset,
  VideoLessonSettings,
  VideoProgress,
  VideoProvider,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";

/** A playback URL outlives the video by this much, for pauses (spec 06: "TTL ≈ duration + margin"). */
const PLAYBACK_MARGIN_SECONDS = 15 * 60;

export type LessonVideo = {
  readonly asset: VideoAsset | null;
  readonly progress: VideoProgress | null;
  readonly playback: PlaybackSource | null;
};

export function requireVideoProvider(context: RequestContext): VideoProvider {
  const provider = context.options.video;
  if (provider !== null) return provider;
  throw new AppError(
    "internal",
    "video_provider_not_configured",
    "Video lessons need a video provider in the module configuration.",
  );
}

export function videoSettings(lesson: LessonDetail): VideoLessonSettings {
  const parsed = videoLessonSettingsSchema.safeParse(lesson.settings);
  return parsed.success ? parsed.data : videoLessonSettingsSchema.parse({});
}

async function playbackFor(
  context: RequestContext,
  asset: VideoAsset | null,
): Promise<PlaybackSource | null> {
  if (asset?.status !== "ready" || asset.durationSeconds === null) return null;
  const provider = requireVideoProvider(context);
  if (provider.name !== asset.provider) {
    context.logger.error("video asset belongs to another provider", {
      requestId: context.requestId,
      lessonId: asset.lessonId,
      provider: asset.provider,
    });
    return null;
  }
  return provider.createPlaybackToken(asset.providerAssetId, {
    learnerId: context.learner.learnerId,
    ttlSeconds: Math.ceil(asset.durationSeconds) + PLAYBACK_MARGIN_SECONDS,
  });
}

/** The video of a lesson for one learner: asset, progress, and a signed playback URL when ready. */
export async function loadLessonVideo(
  context: RequestContext,
  lesson: LessonDetail,
): Promise<LessonVideo> {
  const [asset, progress] = await Promise.all([
    context.storage.findVideoAsset(context.scope, lesson.id),
    context.storage.findVideoProgress(context.scope, context.learner.learnerId, lesson.id),
  ]);
  return { asset, progress, playback: await playbackFor(context, asset) };
}

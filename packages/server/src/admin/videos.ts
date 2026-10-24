import { AppError, videoAssetIdSchema } from "@bebranded/elearning-core";
import type { VideoAsset, VideoProvider } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { presentVideoAsset } from "../presenters/admin.presenters.js";
import { requireVideoProvider } from "../services/video.js";
import { createVideoUploadBody } from "./admin.schemas.js";
import { found } from "./ids.js";
import { parseBody } from "./parse-body.js";

/**
 * Best effort: the replaced file only costs storage at the provider, so a
 * failure is logged and never fails the upload the admin asked for.
 */
async function deleteReplaced(
  context: RequestContext,
  provider: VideoProvider,
  previous: VideoAsset | null,
): Promise<void> {
  if (previous?.provider !== provider.name) return;
  try {
    await provider.deleteAsset(previous.providerAssetId);
  } catch (error) {
    context.logger.warn("replaced video could not be deleted at the provider", {
      requestId: context.requestId,
      lessonId: previous.lessonId,
      error,
    });
  }
}

/**
 * POST /v1/admin/videos/uploads: a one-time upload URL for the lesson's video
 * (spec 06, "Upload"). The browser sends the file straight to the provider;
 * the provider's webhook then marks the asset ready. Uploading again replaces
 * the lesson's video.
 */
export async function createVideoUpload(context: RequestContext): Promise<Response> {
  const body = await parseBody(context, createVideoUploadBody);
  const provider = requireVideoProvider(context);
  const lesson = found(await context.storage.findLesson(context.scope, body.lesson_id));
  if (lesson.type !== "video") {
    throw new AppError("conflict", "not_a_video_lesson", "Only a video lesson takes a video.");
  }
  const previous = await context.storage.findVideoAsset(context.scope, lesson.id);
  const upload = await provider.createDirectUpload({
    maxDurationSeconds: body.max_duration_seconds,
    sizeBytes: body.size_bytes,
  });
  const asset: VideoAsset = {
    id: videoAssetIdSchema.parse(previous?.id ?? context.newId()),
    lessonId: lesson.id,
    provider: provider.name,
    providerAssetId: upload.assetId,
    status: "uploading",
    durationSeconds: null,
    thumbnailUrl: null,
    captions: [],
  };
  found(await context.storage.transaction((tx) => tx.saveVideoAsset(context.scope, asset)));
  if (previous?.providerAssetId !== upload.assetId)
    await deleteReplaced(context, provider, previous);
  return json(
    {
      upload_url: upload.uploadUrl,
      upload_protocol: upload.protocol,
      video: presentVideoAsset(asset),
    },
    context.requestId,
    201,
  );
}

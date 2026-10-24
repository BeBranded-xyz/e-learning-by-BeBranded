import type { LearnerId } from "../content/ids.js";
import type { VideoAssetStatus } from "../video/video.schemas.js";

export type VideoAssetSnapshot = {
  readonly status: VideoAssetStatus;
  readonly durationSeconds: number | null;
  readonly thumbnailUrl: string | null;
};

/** Where a learner plays a video from: a signed, per-learner, short-lived HLS URL. */
export type PlaybackSource = {
  readonly type: "hls";
  readonly url: string;
  readonly expiresAt: Date;
};

/** A provider webhook, once its signature and timestamp are verified. */
export type VideoWebhookEvent = VideoAssetSnapshot & {
  /** The provider's identifier of the asset. */
  readonly assetId: string;
};

/**
 * How the browser sends the file: one `multipart/form-data` POST (`form`), or
 * the resumable tus protocol (`tus`, https://tus.io) for large files.
 */
export type VideoUploadProtocol = "form" | "tus";

export type DirectUpload = {
  readonly uploadUrl: string;
  readonly assetId: string;
  readonly protocol: VideoUploadProtocol;
};

/**
 * Video hosting behind one port (spec 04, "3. Video"). `assetId` is always the
 * provider's identifier, never the module's `video_assets.id`.
 */
export type VideoProvider = {
  readonly name: string;
  /** With `sizeBytes`, a provider may answer a resumable upload for large files. */
  createDirectUpload(input: {
    readonly maxDurationSeconds: number;
    readonly sizeBytes?: number | undefined;
  }): Promise<DirectUpload>;
  getAsset(assetId: string): Promise<VideoAssetSnapshot>;
  createPlaybackToken(
    assetId: string,
    options: { readonly learnerId: LearnerId; readonly ttlSeconds: number },
  ): Promise<PlaybackSource>;
  deleteAsset(assetId: string): Promise<void>;
  /** Returns `null` when the signature or timestamp is invalid. */
  verifyWebhook(request: Request): Promise<VideoWebhookEvent | null>;
};

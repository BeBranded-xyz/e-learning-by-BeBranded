import { AppError } from "@bebranded/elearning-core";
import type { PlaybackSource, VideoProvider } from "@bebranded/elearning-core";

import { streamApi } from "./api.js";
import { cloudflareStreamOptionsSchema } from "./config.js";
import type { CloudflareStreamConfig, CloudflareStreamOptions } from "./config.js";
import { importSigningKey, signPlaybackToken } from "./signing.js";
import { directUploadSchema, streamVideoSchema, toSnapshot } from "./video.schemas.js";
import { verifyStreamWebhook } from "./webhook.js";

const PROVIDER_NAME = "cloudflare-stream";

/** Stream uids are lowercase alphanumeric; anything else never reaches a URL path. */
function videoPath(assetId: string): string {
  if (!/^[0-9a-z]{1,64}$/.test(assetId))
    throw new AppError("internal", "invalid_video_asset_id", "Not a Cloudflare Stream video uid.");
  return `/${assetId}`;
}

function playbackUrl(config: CloudflareStreamConfig, token: string): string {
  return `https://customer-${config.customerCode}.cloudflarestream.com/${token}/manifest/video.m3u8`;
}

/**
 * Cloudflare Stream adapter of the `VideoProvider` port (spec 06). Uploads are
 * private (`requireSignedURLs`) and played through short-lived self-signed
 * tokens, so a copied URL stops working once it expires.
 */
export function cloudflareStream(options: CloudflareStreamOptions): VideoProvider {
  const config = cloudflareStreamOptionsSchema.parse(options);
  const now = config.now ?? (() => new Date());
  let signingKey: Promise<CryptoKey> | undefined;

  return {
    name: PROVIDER_NAME,

    async createDirectUpload({ maxDurationSeconds }) {
      const result = await streamApi(config, {
        method: "POST",
        path: "/direct_upload",
        body: { maxDurationSeconds: Math.ceil(maxDurationSeconds), requireSignedURLs: true },
      });
      const upload = directUploadSchema.parse(result);
      return { uploadUrl: upload.uploadURL, assetId: upload.uid };
    },

    async getAsset(assetId) {
      const result = await streamApi(config, { method: "GET", path: videoPath(assetId) });
      return toSnapshot(streamVideoSchema.parse(result));
    },

    async createPlaybackToken(assetId, { ttlSeconds }): Promise<PlaybackSource> {
      videoPath(assetId);
      signingKey ??= importSigningKey(config.signingKey.jwk);
      const claims = { videoUid: assetId, issuedAt: now(), ttlSeconds };
      const { token, expiresAt } = await signPlaybackToken(config, await signingKey, claims);
      return { type: "hls", url: playbackUrl(config, token), expiresAt };
    },

    async deleteAsset(assetId) {
      await streamApi(config, { method: "DELETE", path: videoPath(assetId) });
    },

    verifyWebhook: (request) =>
      verifyStreamWebhook(request, {
        secret: config.webhookSecret,
        now: now(),
        toleranceSeconds: config.webhookToleranceSeconds,
      }),
  };
}

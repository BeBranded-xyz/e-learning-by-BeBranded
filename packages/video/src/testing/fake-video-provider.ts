import { AppError, videoAssetStatusSchema } from "@bebranded/elearning-core";
import type { VideoAssetSnapshot, VideoProvider } from "@bebranded/elearning-core";

export type FakeVideoProviderOptions = {
  /** Where the fake plays a video from, e.g. a synthetic HLS file served by the demo app. */
  readonly playbackUrl: (assetId: string) => string;
  /** Secret the fake expects as `Authorization: Bearer <secret>` on webhooks. */
  readonly webhookSecret: string;
  readonly now?: () => Date;
};

export type FakeVideoProvider = VideoProvider & {
  /** Assets created so far, by asset id. */
  readonly assets: ReadonlyMap<string, VideoAssetSnapshot>;
  /** Simulates the provider finishing (or failing) the processing of an asset. */
  setAsset(assetId: string, snapshot: VideoAssetSnapshot): void;
};

function parseWebhookBody(body: unknown) {
  if (typeof body !== "object" || body === null) return null;
  const { assetId, status, durationSeconds, thumbnailUrl } = body as Record<string, unknown>;
  const parsedStatus = videoAssetStatusSchema.safeParse(status);
  if (typeof assetId !== "string" || !parsedStatus.success) return null;
  return {
    assetId,
    status: parsedStatus.data,
    durationSeconds: typeof durationSeconds === "number" ? durationSeconds : null,
    thumbnailUrl: typeof thumbnailUrl === "string" ? thumbnailUrl : null,
  };
}

/**
 * In-memory `VideoProvider` for tests and the demo app: no network, no
 * account. Never use it in production: its playback URLs are not signed.
 */
export function fakeVideoProvider(options: FakeVideoProviderOptions): FakeVideoProvider {
  const assets = new Map<string, VideoAssetSnapshot>();
  const now = options.now ?? (() => new Date());
  const find = (assetId: string) => {
    const asset = assets.get(assetId);
    if (asset === undefined)
      throw new AppError(
        "upstream",
        "video_asset_not_found",
        "The fake provider has no such asset.",
      );
    return asset;
  };

  return {
    name: "fake",
    assets,
    setAsset: (assetId, snapshot) => {
      assets.set(assetId, snapshot);
    },
    createDirectUpload: () => {
      const assetId = crypto.randomUUID().replaceAll("-", "");
      assets.set(assetId, { status: "uploading", durationSeconds: null, thumbnailUrl: null });
      return Promise.resolve({ uploadUrl: `https://upload.example.com/${assetId}`, assetId });
    },
    // A throw inside the executor becomes a rejection, like a real provider call.
    getAsset: (assetId) =>
      new Promise((resolve) => {
        resolve(find(assetId));
      }),
    createPlaybackToken: (assetId, { ttlSeconds }) =>
      Promise.resolve({
        type: "hls",
        url: options.playbackUrl(assetId),
        expiresAt: new Date(now().getTime() + ttlSeconds * 1000),
      }),
    deleteAsset: (assetId) => {
      assets.delete(assetId);
      return Promise.resolve();
    },
    verifyWebhook: async (request) => {
      if (request.headers.get("authorization") !== `Bearer ${options.webhookSecret}`) return null;
      const event = parseWebhookBody(await request.json().catch(() => null));
      if (event !== null) assets.set(event.assetId, event);
      return event;
    },
  };
}

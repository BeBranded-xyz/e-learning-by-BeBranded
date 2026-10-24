import type { VideoProvider } from "@bebranded/elearning-core";
import { readAsset } from "./snapshot";
import { demoVideoPlaylist } from "../demo-video";
import { createTicket, MEDIA_ID, mediaQuery } from "./tickets";

/** The demo's provider keeps the seeded assets compatible while accepting real uploads. */
export const demoMediaProvider: VideoProvider = {
  name: "fake",
  createDirectUpload: (input) => Promise.resolve(createTicket(input)),
  getAsset: readAsset,
  createPlaybackToken: (assetId, options) =>
    Promise.resolve({
      type: "hls",
      expiresAt: new Date(Date.now() + options.ttlSeconds * 1000),
      url: MEDIA_ID.test(assetId)
        ? `/demo-media/${assetId}/video.m3u8${mediaQuery("get", assetId, options.ttlSeconds, "video")}`
        : demoVideoPlaylist(assetId),
    }),
  // Demo media follows the uploaded-file retention policy; replacements do not remove existing files.
  deleteAsset: () => Promise.resolve(),
  verifyWebhook: () => Promise.resolve(null),
};

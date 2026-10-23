// Responses shaped after the Cloudflare Stream docs (API reference and webhook
// guide), with synthetic identifiers only (modules/open-source).

export const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
export const SIGNING_KEY_ID = "fedcba9876543210fedcba9876543210";
export const VIDEO_UID = "ea95132c15732412d22c1476fa83f27a";
export const WEBHOOK_SECRET = "test-webhook-secret-not-real";

export function envelope(result: unknown, success = true) {
  return {
    result,
    success,
    errors: success ? [] : [{ code: 10000, message: "failed" }],
    messages: [],
  };
}

export const directUploadResult = {
  uploadURL: `https://upload.videodelivery.net/${VIDEO_UID}`,
  uid: VIDEO_UID,
  scheduledDeletion: null,
  watermark: null,
};

export const readyVideo = {
  uid: VIDEO_UID,
  creator: null,
  thumbnail: `https://customer-test.cloudflarestream.com/${VIDEO_UID}/thumbnails/thumbnail.jpg`,
  thumbnailTimestampPct: 0,
  readyToStream: true,
  status: { state: "ready", pctComplete: "100.000000", errorReasonCode: "", errorReasonText: "" },
  meta: {},
  created: "2026-10-23T09:00:00.000Z",
  modified: "2026-10-23T09:01:00.000Z",
  size: 4190963,
  preview: `https://customer-test.cloudflarestream.com/${VIDEO_UID}/watch`,
  allowedOrigins: [],
  requireSignedURLs: true,
  uploaded: "2026-10-23T09:00:30.000Z",
  uploadExpiry: null,
  maxSizeBytes: null,
  maxDurationSeconds: 600,
  duration: 5.5,
  input: { width: 1920, height: 1080 },
  playback: {
    hls: `https://customer-test.cloudflarestream.com/${VIDEO_UID}/manifest/video.m3u8`,
    dash: `https://customer-test.cloudflarestream.com/${VIDEO_UID}/manifest/video.mpd`,
  },
  watermark: null,
};

/** The error example of the webhook guide, which spells the reason fields `errReason*`. */
export const erroredVideo = {
  uid: VIDEO_UID,
  readyToStream: false,
  status: {
    state: "error",
    step: "encoding",
    pctComplete: "39",
    errReasonCode: "ERR_MALFORMED_VIDEO",
    errReasonText: "The video was deemed to be corrupted or malformed.",
  },
  duration: -1,
};

export const pendingVideo = {
  uid: VIDEO_UID,
  readyToStream: false,
  status: { state: "pendingupload" },
  duration: -1,
};

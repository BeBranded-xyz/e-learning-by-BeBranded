import path from "node:path";

/**
 * The demo's synthetic video: a 30 s ffmpeg test pattern, generated locally
 * into a gitignored folder (no media file is committed) and served by
 * app/demo-video. VP9 in fragmented MP4 plays in every evergreen browser,
 * including Playwright's Chromium, which has no H.264 decoder.
 */
export const DEMO_VIDEO_SECONDS = 30;
export const DEMO_VIDEO_PLAYLIST = "/demo-video/video.m3u8";

export function demoVideoDir(): string {
  return path.join(process.cwd(), ".demo-video");
}

/** The only files the route serves; anything else is a 404 (no path from the request reaches the disk). */
export const DEMO_VIDEO_FILES: Readonly<Record<string, string>> = {
  "video.m3u8": "application/vnd.apple.mpegurl",
  "init.mp4": "video/mp4",
  ...Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [
      `seg${String(index).padStart(2, "0")}.m4s`,
      "video/iso.segment",
    ]),
  ),
};

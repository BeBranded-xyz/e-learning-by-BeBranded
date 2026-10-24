import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { DEMO_VIDEO_SCENES, DEMO_VIDEO_SECONDS, demoVideoDir } from "../lib/demo-video.js";
import type { DemoScene } from "../lib/demo-video.js";

// Big Buck Bunny, Blender Foundation, CC BY 3.0. See the media attribution in README.md.
const SOURCE = "https://test-streams.mux.dev/x36xhzz/url_4/193039199_mp4_h264_aac_7.m3u8";

function generateScene(dir: string, scene: DemoScene): void {
  const fixture = process.env.DEMO_VIDEO_FIXTURE === "1";
  const input = fixture
    ? ["-f", "lavfi", "-i", `testsrc2=size=512x288:rate=25:duration=${String(DEMO_VIDEO_SECONDS)}`]
    : ["-ss", scene === "opening" ? "30" : "120", "-i", SOURCE];
  // Fixed arguments only; VP9 keeps the native player usable in Chromium test builds.
  execFileSync(
    "ffmpeg",
    [
      ["-hide_banner", "-loglevel", "error", "-y"],
      input,
      ["-t", String(DEMO_VIDEO_SECONDS), "-map", "0:v:0", "-map", "0:a:0?"],
      ["-c:v", "libvpx-vp9", "-b:v", "500k", "-deadline", "realtime", "-cpu-used", "8"],
      ["-c:a", "aac", "-b:a", "96k", "-g", "50", "-pix_fmt", "yuv420p"],
      ["-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod", "-hls_segment_type", "fmp4"],
      [
        "-hls_fmp4_init_filename",
        `${scene}-init.mp4`,
        "-hls_segment_filename",
        `${scene}-seg%02d.m4s`,
      ],
      [`${scene}.m3u8`],
    ].flat(),
    { cwd: dir, stdio: "inherit", timeout: 120_000 },
  );
}

/** Downloads and encodes only the excerpts; generated media stays outside Git. */
export function ensureDemoVideo(): void {
  const dir = demoVideoDir();
  mkdirSync(dir, { recursive: true });
  for (const scene of DEMO_VIDEO_SCENES) {
    if (!existsSync(path.join(dir, `${scene}.m3u8`))) generateScene(dir, scene);
  }
}

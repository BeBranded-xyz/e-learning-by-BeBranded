import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { DEMO_VIDEO_SECONDS, demoVideoDir } from "../lib/demo-video.js";

/**
 * Generates the demo's synthetic HLS stream with ffmpeg unless it exists:
 * a test pattern, no audio, VP9 in fragmented MP4, 4 s segments.
 */
export function ensureDemoVideo(): void {
  const dir = demoVideoDir();
  if (existsSync(path.join(dir, "video.m3u8"))) return;
  mkdirSync(dir, { recursive: true });
  // Arguments are fixed constants: no user input reaches the command line.
  execFileSync(
    "ffmpeg",
    [
      ["-hide_banner", "-loglevel", "error", "-y"],
      ["-f", "lavfi", "-i", `testsrc2=size=640x360:rate=25:duration=${String(DEMO_VIDEO_SECONDS)}`],
      ["-c:v", "libvpx-vp9", "-b:v", "300k", "-deadline", "realtime", "-cpu-used", "8"],
      ["-g", "50", "-pix_fmt", "yuv420p"],
      ["-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod", "-hls_segment_type", "fmp4"],
      ["-hls_fmp4_init_filename", "init.mp4", "-hls_segment_filename", "seg%02d.m4s"],
      ["video.m3u8"],
    ].flat(),
    { cwd: dir, stdio: "inherit" },
  );
}

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { demoFilesDir } from "../demo-files";
import type { UploadTicket } from "./tickets";

const run = promisify(execFile);
export const mediaDir = (id: string) => path.join(demoFilesDir(), "videos", id);

export function isVideoContainer(bytes: Uint8Array): boolean {
  return (
    (bytes.length >= 12 && Buffer.from(bytes.subarray(4, 8)).toString("ascii") === "ftyp") ||
    (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
  );
}

function encoderArguments(input: string, maxDuration: number): string[] {
  return [
    ["-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe", "-i", input],
    ["-map", "0:v:0", "-map", "0:a:0?", "-t", String(maxDuration)],
    ["-vf", "scale=w='min(1280,iw)':h=-2", "-c:v", "libvpx-vp9", "-threads", "2"],
    ["-b:v", "700k", "-deadline", "realtime", "-cpu-used", "8", "-g", "50", "-pix_fmt", "yuv420p"],
    ["-c:a", "aac", "-b:a", "96k", "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod"],
    ["-hls_segment_type", "fmp4", "-hls_fmp4_init_filename", "init.mp4"],
    ["-hls_segment_filename", "seg%05d.m4s", "video.m3u8"],
  ].flat();
}

/** Only local MP4/WebM input reaches ffmpeg; no remote protocol or arbitrary input path. */
export async function encodeUpload(
  id: string,
  file: File,
  ticket: UploadTicket,
  signal: AbortSignal,
): Promise<number> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isVideoContainer(bytes)) throw new Error("Unsupported video container");
  const dir = mediaDir(id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const input = path.join(dir, "source");
  await writeFile(input, bytes, { flag: "wx", signal });
  const probe = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      input,
    ],
    { timeout: 15_000, signal, encoding: "utf8" },
  );
  const duration = Number(probe.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0 || duration > ticket.maxDuration)
    throw new Error("Invalid video duration");
  await run("ffmpeg", encoderArguments(input, ticket.maxDuration), {
    cwd: dir,
    timeout: 120_000,
    signal,
    maxBuffer: 1024 * 1024,
  });
  return duration;
}

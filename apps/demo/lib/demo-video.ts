import path from "node:path";

/** Two attributed excerpts; the test runner uses isolated synthetic fixtures. */
export const DEMO_VIDEO_SECONDS = 30;
export const DEMO_VIDEO_SCENES = ["opening", "forest"] as const;
export type DemoScene = (typeof DEMO_VIDEO_SCENES)[number];

export function demoVideoPlaylist(assetId: string): string {
  const scene = assetId === "demo-forest" ? "forest" : "opening";
  return `/demo-video/${scene}.m3u8`;
}

export function demoVideoDir(): string {
  return path.join(
    process.cwd(),
    process.env.DEMO_VIDEO_FIXTURE === "1" ? ".demo-video-test" : ".demo-video",
  );
}

/** A fixed allowlist: request paths never reach disk unchecked. */
export const DEMO_VIDEO_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  DEMO_VIDEO_SCENES.flatMap((scene): [string, string][] => [
    [`${scene}.m3u8`, "application/vnd.apple.mpegurl"],
    [`${scene}-init.mp4`, "video/mp4"],
    ...Array.from({ length: 8 }, (_, index): [string, string] => [
      `${scene}-seg${String(index).padStart(2, "0")}.m4s`,
      "video/iso.segment",
    ]),
  ]),
);

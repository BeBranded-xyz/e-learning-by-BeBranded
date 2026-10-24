import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { videoAssetStatusSchema } from "@bebranded/elearning-core";
import type { VideoAssetSnapshot } from "@bebranded/elearning-core";
import { DEMO_VIDEO_SECONDS } from "../demo-video";
import { mediaDir } from "./encode";
import { findTicket, MEDIA_ID } from "./tickets";

const snapshot = z.object({
  status: videoAssetStatusSchema,
  durationSeconds: z.number().positive().nullable(),
  thumbnailUrl: z.string().nullable(),
});
export async function readAsset(id: string): Promise<VideoAssetSnapshot> {
  if (!MEDIA_ID.test(id))
    return { status: "ready", durationSeconds: DEMO_VIDEO_SECONDS, thumbnailUrl: null };
  if (findTicket(id)) return { status: "uploading", durationSeconds: null, thumbnailUrl: null };
  try {
    return snapshot.parse(
      JSON.parse(await readFile(path.join(mediaDir(id), "asset.json"), "utf8")),
    );
  } catch {
    return { status: "error", durationSeconds: null, thumbnailUrl: null };
  }
}

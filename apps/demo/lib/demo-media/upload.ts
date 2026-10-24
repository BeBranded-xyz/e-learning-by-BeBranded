import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { verify } from "../demo-files";
import { demoSession } from "../demo-session";
import { readEnv } from "../env";
import { getDemoStorage } from "../demo-storage";
import { encodeUpload, mediaDir } from "./encode";
import {
  acquireEncoder,
  consumeTicket,
  findTicket,
  MAX_VIDEO_BYTES,
  MEDIA_ID,
  releaseEncoder,
  terms,
} from "./tickets";

function failure(status: number, code: string): Response {
  const requestId = randomUUID();
  return Response.json(
    {
      error: { code, message: "The video upload could not be accepted.", request_id: requestId },
    },
    { status, headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return (
    origin === new URL(request.url).origin || origin === new URL(readEnv().DEMO_PUBLIC_URL).origin
  );
}

async function updateAsset(
  id: string,
  status: "processing" | "ready" | "error",
  durationSeconds: number | null = null,
) {
  await mkdir(mediaDir(id), { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(mediaDir(id), "asset.json"),
    JSON.stringify({ status, durationSeconds, thumbnailUrl: null }),
  );
  await getDemoStorage().transaction((tx) =>
    tx.applyVideoWebhook("fake", { assetId: id, status, durationSeconds, thumbnailUrl: null }),
  );
}

function acceptedTicket(request: Request, id: string) {
  const ticket = findTicket(id);
  if (
    !MEDIA_ID.test(id) ||
    ticket === undefined ||
    ticket.expires < Date.now() ||
    !verify("put", id, new URL(request.url).searchParams, terms(ticket))
  )
    return failure(403, "invalid_signature");
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length <= 0 || length > MAX_VIDEO_BYTES + 65536)
    return failure(413, "file_too_large");
  return ticket;
}

/** Admin + origin + expiring one-use ticket, then bounded processing with no detached job. */
export async function uploadDemoMedia(request: Request, id: string): Promise<Response> {
  if ((await demoSession()).persona !== "admin") return failure(403, "forbidden");
  if (!sameOrigin(request)) return failure(403, "origin_not_allowed");
  const ticket = acceptedTicket(request, id);
  if (ticket instanceof Response) return ticket;
  if (!acquireEncoder()) return failure(429, "upload_busy");
  consumeTicket(id);
  try {
    const data = await request.formData();
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      file.size !== ticket.size ||
      !["video/mp4", "video/webm"].includes(file.type)
    ) {
      await updateAsset(id, "error");
      return failure(415, "file_type_not_allowed");
    }
    await updateAsset(id, "processing");
    const duration = await encodeUpload(id, file, ticket, request.signal);
    await updateAsset(id, "ready", duration);
    return Response.json({ received: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    process.stderr.write(
      JSON.stringify({
        level: "error",
        feature: "demo_video_upload",
        code: "video_processing_failed",
        assetId: id,
      }) + "\n",
    );
    await updateAsset(id, "error");
    return failure(422, "video_processing_failed");
  } finally {
    releaseEncoder();
  }
}

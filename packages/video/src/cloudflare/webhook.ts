import type { VideoWebhookEvent } from "@bebranded/elearning-core";

import { streamVideoSchema, toSnapshot } from "./video.schemas.js";

/** Webhook bodies are small video objects; anything larger is refused unread. */
export const MAX_WEBHOOK_BYTES = 64 * 1024;

const encoder = new TextEncoder();

type SignatureHeader = { readonly time: number; readonly signature: Uint8Array<ArrayBuffer> };

/** Parses `Webhook-Signature: time=<unix seconds>,sig1=<hex HMAC-SHA256>`. */
export function parseSignatureHeader(header: string | null): SignatureHeader | null {
  if (header === null) return null;
  const parts = new Map(
    header.split(",").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const;
    }),
  );
  const time = parts.get("time") ?? "";
  const sig = parts.get("sig1") ?? "";
  if (!/^\d{1,12}$/.test(time) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  const signature = Uint8Array.from({ length: 32 }, (_, index) =>
    parseInt(sig.slice(index * 2, index * 2 + 2), 16),
  );
  return { time: Number(time), signature };
}

async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_WEBHOOK_BYTES) return null;
  const body = await request.text();
  return encoder.encode(body).byteLength > MAX_WEBHOOK_BYTES ? null : body;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    // A signed body that is not JSON is treated like any invalid webhook.
    return null;
  }
}

function isRecent(time: number, now: Date, toleranceSeconds: number): boolean {
  return Math.abs(now.getTime() / 1000 - time) <= toleranceSeconds;
}

/**
 * Verifies a Stream webhook: HMAC-SHA256 of `<time>.<raw body>` with the
 * webhook secret, compared in constant time by `crypto.subtle.verify`, and a
 * timestamp within the tolerance against replays. Null when anything fails.
 * See https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/.
 */
export async function verifyStreamWebhook(
  request: Request,
  options: { secret: string; now: Date; toleranceSeconds: number },
): Promise<VideoWebhookEvent | null> {
  const header = parseSignatureHeader(request.headers.get("webhook-signature"));
  if (header === null || !isRecent(header.time, options.now, options.toleranceSeconds)) return null;
  const body = await readBody(request);
  if (body === null) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(options.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    header.signature,
    encoder.encode(`${header.time}.${body}`),
  );
  if (!valid) return null;
  const video = streamVideoSchema.safeParse(parseJson(body));
  return video.success ? { assetId: video.data.uid, ...toSnapshot(video.data) } : null;
}

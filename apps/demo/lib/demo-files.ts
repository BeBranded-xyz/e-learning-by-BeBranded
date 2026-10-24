import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { FileStorage } from "@bebranded/elearning-core";

/**
 * The demo's FileStorage (spec 04, section 4): files on the local disk,
 * behind signed, expiring URLs served by app/demo-files. A real host plugs
 * S3, R2 or Supabase Storage in here. The signing secret is random per
 * process, so URLs never outlive the demo server.
 */

const KEY = /^[0-9a-f-]{36}$/;
const holder = globalThis as typeof globalThis & { demoFilesSecret?: Buffer };

function secret(): Buffer {
  holder.demoFilesSecret ??= randomBytes(32);
  return holder.demoFilesSecret;
}

export function demoFilesDir(): string {
  return path.join(os.tmpdir(), "elearning-demo-files");
}

function sign(action: "put" | "get", key: string, expires: number, extra = ""): string {
  return createHmac("sha256", secret())
    .update(`${action}:${key}:${expires}:${extra}`)
    .digest("hex");
}

/** Constant-time check of a signature and its expiry; the key format is checked first. */
export function verify(
  action: "put" | "get",
  key: string,
  params: URLSearchParams,
  extra = "",
): boolean {
  const expires = Number(params.get("exp"));
  const signature = params.get("sig") ?? "";
  if (!KEY.test(key) || !Number.isSafeInteger(expires) || expires < Date.now()) return false;
  const expected = Buffer.from(sign(action, key, expires, extra), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function signedUrl(
  action: "put" | "get",
  key: string,
  ttlSeconds: number,
  extra = "",
): string {
  const expires = Date.now() + ttlSeconds * 1000;
  const query = new URLSearchParams({
    exp: String(expires),
    sig: sign(action, key, expires, extra),
  });
  return `/demo-files/${key}?${query.toString()}`;
}

/** What an upload promised: its type and size, so the PUT cannot store anything else. */
export function uploadTerms(mimeType: string, sizeBytes: number): string {
  return `${mimeType}|${sizeBytes}`;
}

export async function storeFile(key: string, mimeType: string, body: Uint8Array): Promise<void> {
  await mkdir(demoFilesDir(), { recursive: true });
  await writeFile(path.join(demoFilesDir(), key), body);
  await writeFile(path.join(demoFilesDir(), `${key}.json`), JSON.stringify({ mimeType }));
}

export async function readStoredFile(
  key: string,
  signal?: AbortSignal,
): Promise<{ mimeType: string; body: Buffer } | null> {
  try {
    const meta: unknown = JSON.parse(
      await readFile(path.join(demoFilesDir(), `${key}.json`), { encoding: "utf8", signal }),
    );
    const mimeType =
      typeof meta === "object" &&
      meta !== null &&
      "mimeType" in meta &&
      typeof meta.mimeType === "string"
        ? meta.mimeType
        : "application/octet-stream";
    return { mimeType, body: await readFile(path.join(demoFilesDir(), key), { signal }) };
  } catch {
    signal?.throwIfAborted();
    return null;
  }
}

export const demoFileStorage: FileStorage = {
  createUpload: ({ mimeType, sizeBytes }) => {
    const key = randomUUID();
    const uploadUrl = signedUrl("put", key, 15 * 60, uploadTerms(mimeType, sizeBytes));
    return Promise.resolve({
      uploadUrl: `${uploadUrl}&type=${encodeURIComponent(mimeType)}&size=${sizeBytes}`,
      key,
    });
  },
  getReadUrl: (key, { ttlSeconds }) => Promise.resolve(signedUrl("get", key, ttlSeconds)),
  // Exports inline images from their bytes (spec 10); a missing file leaves the image out.
  read: async (key, options) => {
    if (!KEY.test(key)) throw new Error("not a demo file key");
    const stored = await readStoredFile(key, options?.signal);
    if (stored === null) throw new Error("demo file not found");
    return new Uint8Array(stored.body);
  },
  // The demo keeps files until its temporary directory is cleaned.
  delete: () => Promise.resolve(),
};

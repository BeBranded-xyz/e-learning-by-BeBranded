import type { Fetcher } from "@bebranded/elearning-react";

import { UploadFailedError } from "./file-upload.js";

/** 50 MiB: a multiple of 256 KiB, as Cloudflare Stream requires for tus chunks. */
const TUS_CHUNK_BYTES = 50 * 1024 * 1024;
const RETRIES = 3;

export type TusOptions = {
  readonly fetcher: Fetcher;
  readonly onProgress?: (sentBytes: number) => void;
  readonly signal?: AbortSignal;
  /** Injected for tests; waits between retries. */
  readonly wait?: (ms: number) => Promise<void>;
  /** Injected for tests; a multiple of 256 KiB in production. */
  readonly chunkBytes?: number;
};

const TUS_HEADERS = { "Tus-Resumable": "1.0.0" } as const;

function offsetOf(response: Response): number | null {
  const value = Number(response.headers.get("upload-offset"));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Where the provider is, after a failure: a HEAD answers the stored offset. */
async function serverOffset(url: string, options: TusOptions): Promise<number | null> {
  const response = await options.fetcher(url, {
    method: "HEAD",
    headers: TUS_HEADERS,
    ...signalOf(options),
  });
  return response.ok ? offsetOf(response) : null;
}

const signalOf = (options: TusOptions) =>
  options.signal === undefined ? {} : { signal: options.signal };

async function sendChunk(
  url: string,
  file: Blob,
  offset: number,
  options: TusOptions,
): Promise<number | null> {
  const size = options.chunkBytes ?? TUS_CHUNK_BYTES;
  const chunk = file.slice(offset, Math.min(offset + size, file.size));
  const response = await options.fetcher(url, {
    method: "PATCH",
    headers: {
      ...TUS_HEADERS,
      "Upload-Offset": String(offset),
      "Content-Type": "application/offset+octet-stream",
    },
    body: chunk,
    ...signalOf(options),
  });
  return response.ok ? offsetOf(response) : null;
}

/**
 * Resumable upload to a tus URL created by the server (spec 06): PATCH in
 * chunks; after a failed chunk, ask the provider for its offset and resume,
 * up to three times in a row with a growing pause.
 */
export async function tusUpload(url: string, file: Blob, options: TusOptions): Promise<void> {
  const wait =
    options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let offset = 0;
  let failures = 0;
  while (offset < file.size) {
    const next = await sendChunk(url, file, offset, options).catch(() => null);
    if (next !== null && next > offset) {
      offset = next;
      failures = 0;
      options.onProgress?.(offset);
      continue;
    }
    failures += 1;
    if (failures > RETRIES || options.signal?.aborted === true) throw new UploadFailedError(0);
    await wait(1000 * 2 ** failures);
    offset = (await serverOffset(url, options).catch(() => null)) ?? offset;
  }
}

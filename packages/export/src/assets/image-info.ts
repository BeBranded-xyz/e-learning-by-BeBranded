/**
 * Image type and size read from the bytes themselves (magic numbers), never
 * from a declared MIME type: an export only embeds real raster pictures.
 */

export type ImageKind = "png" | "jpeg" | "gif" | "webp";

export type ImageInfo = {
  readonly kind: ImageKind;
  readonly width: number;
  readonly height: number;
};

const MIME: Record<ImageKind, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export function mimeOf(kind: ImageKind): string {
  return MIME[kind];
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function sized(kind: ImageKind, width: number, height: number): ImageInfo | null {
  return width > 0 && height > 0 && width <= 30_000 && height <= 30_000
    ? { kind, width, height }
    : null;
}

function png(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 24 || !startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return null;
  return sized("png", view(bytes).getUint32(16), view(bytes).getUint32(20));
}

function gif(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 10 || !startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return null;
  return sized("gif", view(bytes).getUint16(6, true), view(bytes).getUint16(8, true));
}

/** Start-of-frame markers (baseline, progressive…), excluding DHT, JPG and DAC. */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpeg(bytes: Uint8Array): ImageInfo | null {
  if (!startsWith(bytes, [0xff, 0xd8])) return null;
  const data = view(bytes);
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    const length = data.getUint16(offset + 2);
    if (SOF.has(marker))
      return sized("jpeg", data.getUint16(offset + 7), data.getUint16(offset + 5));
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webp(bytes: Uint8Array): ImageInfo | null {
  if (
    bytes.length < 30 ||
    !startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) ||
    !startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return null;
  const data = view(bytes);
  if (startsWith(bytes, [0x56, 0x50, 0x38, 0x58], 12)) {
    // Canvas size minus one, as two 24-bit little-endian numbers.
    const uint24 = (offset: number) =>
      data.getUint16(offset, true) + ((bytes[offset + 2] ?? 0) << 16);
    return sized("webp", 1 + uint24(24), 1 + uint24(27));
  }
  if (startsWith(bytes, [0x56, 0x50, 0x38, 0x20], 12)) {
    return sized("webp", data.getUint16(26, true) & 0x3fff, data.getUint16(28, true) & 0x3fff);
  }
  if (startsWith(bytes, [0x56, 0x50, 0x38, 0x4c], 12)) {
    const bits = data.getUint32(21, true);
    return sized("webp", 1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff));
  }
  return null;
}

/** Null for anything that is not a well-formed PNG, JPEG, GIF or WebP picture. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  return png(bytes) ?? jpeg(bytes) ?? gif(bytes) ?? webp(bytes);
}

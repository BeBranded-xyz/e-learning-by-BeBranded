import { AppError, EXPORT_LIMITS, exportImageIds } from "@bebranded/elearning-core";
import type { ExportDocument, FileId } from "@bebranded/elearning-core";

import { imageInfo, mimeOf } from "./image-info.js";
import type { ImageInfo } from "./image-info.js";

export type InlinedImage = ImageInfo & { readonly bytes: Uint8Array; readonly dataUri: string };

/** Reads an uploaded file through the host's FileStorage; null when it is gone. */
export type ImageLoader = (fileId: FileId, signal?: AbortSignal) => Promise<Uint8Array | null>;

const tooLarge = (message: string) => new AppError("validation", "export_too_large", message);

/**
 * Fetches every image of the document through the loader, before any
 * rendering (spec 10): the renderers never fetch anything. Files that are
 * not real PNG, JPEG, GIF or WebP pictures, or are gone, are left out.
 */
export async function inlineImages(
  document: ExportDocument,
  load: ImageLoader,
  signal?: AbortSignal,
): Promise<Map<FileId, InlinedImage>> {
  const ids = exportImageIds(document);
  if (ids.length > EXPORT_LIMITS.maxImages)
    throw tooLarge(`At most ${EXPORT_LIMITS.maxImages} images per export`);
  const images = new Map<FileId, InlinedImage>();
  let total = 0;
  for (const id of ids) {
    signal?.throwIfAborted();
    const bytes = await load(id, signal);
    signal?.throwIfAborted();
    if (bytes === null) continue;
    total += bytes.byteLength;
    if (total > EXPORT_LIMITS.maxImageBytes)
      throw tooLarge("The images of this export are too large");
    const info = imageInfo(bytes);
    if (info === null) continue;
    const dataUri = `data:${mimeOf(info.kind)};base64,${Buffer.from(bytes).toString("base64")}`;
    images.set(id, { ...info, bytes, dataUri });
  }
  return images;
}

import { fileIdSchema } from "./ids.js";
import type { FileId } from "./ids.js";
import { FILE_URL_PREFIX } from "./lesson-document.schemas.js";
import type { ColumnBlock, LessonBlock } from "./lesson-document.types.js";

/** The file a media block points to; null for an empty or foreign url. */
export function fileIdFromUrl(url: string): FileId | null {
  if (!url.startsWith(FILE_URL_PREFIX)) return null;
  const parsed = fileIdSchema.safeParse(url.slice(FILE_URL_PREFIX.length));
  return parsed.success ? parsed.data : null;
}

export function fileUrl(id: FileId): string {
  return `${FILE_URL_PREFIX}${id}`;
}

/**
 * Every uploaded file a validated document refers to, once each, in reading
 * order. Iterative, like the validator, so depth costs no stack.
 */
export function collectFileIds(blocks: readonly LessonBlock[]): FileId[] {
  const ids = new Set<FileId>();
  const stack: (LessonBlock | ColumnBlock)[] = [...blocks].reverse();
  for (let block = stack.pop(); block !== undefined; block = stack.pop()) {
    if (block.type === "image" || block.type === "file") {
      const id = fileIdFromUrl(block.props.url);
      if (id !== null) ids.add(id);
    }
    for (let index = block.children.length - 1; index >= 0; index -= 1) {
      const child = block.children[index];
      if (child !== undefined) stack.push(child);
    }
  }
  return [...ids];
}

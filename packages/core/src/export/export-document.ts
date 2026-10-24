import type { LessonType } from "../content/content.schemas.js";
import type { FileId } from "../content/ids.js";
import type { LessonDocument } from "../content/lesson-document.types.js";
import type { ExportBlock, ExportDocument, ExportSection } from "./export-document.types.js";
import { toExportBlocks } from "./to-export-blocks.js";

/** Bounds of one export (spec 10, "Export security"); checked before any rendering. */
export const EXPORT_LIMITS = {
  maxBlocks: 20_000,
  maxImageBytes: 25 * 1024 * 1024,
  maxImages: 200,
} as const;

export type ExportLesson = {
  readonly title: string;
  readonly type: LessonType;
  /** Validated content; for video and quiz lessons, their notes. */
  readonly content: LessonDocument | null;
  /** The lesson's page in the host, linked from video blocks. */
  readonly url: string;
};

/**
 * A lesson as a section. Video lessons show their title and a link back to
 * the lesson; quiz questions are never exported (spec 10, "Block mapping"),
 * only the notes around them.
 */
export function lessonSection(lesson: ExportLesson, depth: 1 | 2): ExportSection {
  const notes = lesson.content === null ? [] : toExportBlocks(lesson.content);
  const video: ExportBlock[] =
    lesson.type === "video" ? [{ type: "video", title: lesson.title, url: lesson.url }] : [];
  return { title: lesson.title, depth, url: lesson.url, blocks: [...video, ...notes] };
}

type Meta = { readonly locale: string; readonly exportedAt: Date };

export function buildLessonExport(
  input: Meta & { readonly lesson: ExportLesson; readonly courseTitle: string },
): ExportDocument {
  return {
    title: input.lesson.title,
    subtitle: input.courseTitle,
    locale: input.locale,
    exportedAt: input.exportedAt.toISOString(),
    isCourse: false,
    sections: [lessonSection(input.lesson, 1)],
  };
}

export type ExportChapter = { readonly title: string; readonly lessons: readonly ExportLesson[] };

/** A course: a cover, then each chapter (depth 1) and its lessons (depth 2), in order. */
export function buildCourseExport(
  input: Meta & {
    readonly course: { readonly title: string; readonly summary: string | null };
    readonly chapters: readonly ExportChapter[];
  },
): ExportDocument {
  return {
    title: input.course.title,
    subtitle: input.course.summary,
    locale: input.locale,
    exportedAt: input.exportedAt.toISOString(),
    isCourse: true,
    sections: input.chapters.flatMap((chapter) => [
      { title: chapter.title, depth: 1 as const, url: null, blocks: [] },
      ...chapter.lessons.map((lesson) => lessonSection(lesson, 2)),
    ]),
  };
}

/** Blocks nested inside a block: list item children, callout content, groups. */
function children(block: ExportBlock): readonly ExportBlock[] {
  if (block.type === "list") return block.items.flatMap((item) => item.children);
  if (block.type === "callout") return block.children;
  return block.type === "group" ? block.blocks : [];
}

/** Every block of the document, depth first; iterative, so depth costs no stack. */
export function* walkExport(document: ExportDocument): Generator<ExportBlock> {
  const stack = document.sections.flatMap((section) => section.blocks).reverse();
  for (let block = stack.pop(); block !== undefined; block = stack.pop()) {
    yield block;
    stack.push(...[...children(block)].reverse());
  }
}

/** The uploaded images to inline, once each, in reading order. */
export function exportImageIds(document: ExportDocument): FileId[] {
  const ids = new Set<FileId>();
  for (const block of walkExport(document)) if (block.type === "image") ids.add(block.fileId);
  return [...ids];
}

export function countExportBlocks(document: ExportDocument): number {
  let count = 0;
  for (const block of walkExport(document)) count += block.type === "list" ? block.items.length : 1;
  return count;
}

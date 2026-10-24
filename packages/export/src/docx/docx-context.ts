import { AlignmentType } from "docx";

import type { ExportAlignment, FileId } from "@bebranded/elearning-core";

import type { InlinedImage } from "../assets/inline-images.js";
import type { NumberingRegistry } from "./docx-numbering.js";

export type DocxContext = {
  readonly images: ReadonlyMap<FileId, InlinedImage>;
  readonly numbering: NumberingRegistry;
  /** Content headings sit below the document and section titles. */
  readonly headingOffset: number;
  /** Indentation level of nested blocks and lists. */
  readonly depth: number;
  readonly lessonUrl: string | null;
  readonly labels: { readonly video: string; readonly attachment: string };
  /** Usable page width in pixels, for scaling images. */
  readonly contentWidth: number;
};

export const nestedIn = (context: DocxContext): DocxContext => ({
  ...context,
  depth: context.depth + 1,
});

export const indentOf = (context: DocxContext) =>
  context.depth === 0 ? {} : { indent: { left: 720 * context.depth } };

const ALIGNMENTS = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const;

export const alignmentOf = (alignment: ExportAlignment) => ALIGNMENTS[alignment];

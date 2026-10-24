import type { FileId } from "../content/ids.js";
import type { CalloutVariant, Color, InlineContent } from "../content/lesson-document.types.js";

/**
 * The intermediate tree every export format renders (spec 10, "Pipeline"):
 * lesson content is converted once, then each renderer (HTML for PDF, Word)
 * walks the same tree. Only data the requester may read ends up here.
 */

export type ExportAlignment = "left" | "center" | "right" | "justify";

export type ExportText = {
  readonly content: InlineContent;
  readonly alignment: ExportAlignment;
  readonly textColor: Color;
  readonly backgroundColor: Color;
};

export type ExportListItem = {
  readonly text: ExportText;
  /** Check lists only; null otherwise. */
  readonly checked: boolean | null;
  readonly children: readonly ExportBlock[];
};

export type ExportTableCell = {
  readonly content: InlineContent;
  readonly header: boolean;
  readonly colspan: number;
  readonly rowspan: number;
};

export type ExportBlock =
  | { readonly type: "heading"; readonly level: 1 | 2 | 3; readonly text: ExportText }
  | { readonly type: "paragraph"; readonly text: ExportText }
  | {
      readonly type: "list";
      readonly style: "bullet" | "numbered" | "check";
      readonly start: number;
      readonly items: readonly ExportListItem[];
    }
  | { readonly type: "quote"; readonly text: ExportText }
  | {
      readonly type: "callout";
      readonly variant: CalloutVariant;
      readonly text: ExportText;
      readonly children: readonly ExportBlock[];
    }
  | { readonly type: "code"; readonly language: string; readonly code: string }
  | {
      readonly type: "table";
      /** Rows at the top repeated on every page. */
      readonly headerRows: number;
      readonly rows: readonly (readonly ExportTableCell[])[];
    }
  | { readonly type: "divider" }
  | {
      readonly type: "image";
      readonly fileId: FileId;
      readonly name: string;
      readonly caption: string;
      /** Display width in CSS pixels; null for the natural width (capped by the page). */
      readonly width: number | null;
      readonly alignment: ExportAlignment;
    }
  | {
      readonly type: "file";
      readonly fileId: FileId;
      readonly name: string;
      readonly caption: string;
    }
  /** A video lesson: its title and a link back to the lesson (spec 10, "Block mapping"). */
  | { readonly type: "video"; readonly title: string; readonly url: string }
  /** Nested blocks under a paragraph or an expanded toggle, indented one level. */
  | { readonly type: "group"; readonly blocks: readonly ExportBlock[] };

/** A chapter (depth 1) or a lesson (depth 2 in a course export, 1 for a lesson export). */
export type ExportSection = {
  readonly title: string;
  readonly depth: 1 | 2;
  /** The lesson's page, which attachments link to; null for a chapter. */
  readonly url: string | null;
  readonly blocks: readonly ExportBlock[];
};

export type ExportDocument = {
  readonly title: string;
  /** The course of an exported lesson, or the summary of an exported course. */
  readonly subtitle: string | null;
  readonly locale: string;
  readonly exportedAt: string;
  /** True for a course export: a cover page and a table of contents. */
  readonly isCourse: boolean;
  readonly sections: readonly ExportSection[];
};

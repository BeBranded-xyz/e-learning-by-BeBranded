import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TableOfContents,
  TextRun,
} from "docx";
import type { FileChild } from "docx";

import type { ExportDocument, ExportSection, FileId } from "@bebranded/elearning-core";

import type { InlinedImage } from "../assets/inline-images.js";
import { formatExportDate, labelsFor } from "../labels.js";
import { docxBlocks } from "./docx-blocks.js";
import { NumberingRegistry } from "./docx-numbering.js";

export type DocxOptions = {
  readonly images: ReadonlyMap<FileId, InlinedImage>;
  readonly pageSize: "A4" | "Letter";
};

/** Page sizes in twentieths of a point; usable width in pixels at 96 dpi after 2 cm margins. */
const PAGES = {
  A4: { width: 11906, height: 16838, contentWidth: 642 },
  Letter: { width: 12240, height: 15840, contentWidth: 665 },
} as const;
const MARGIN = 1134;

const STYLES = {
  paragraphStyles: [
    {
      id: "Quote",
      name: "Quote",
      basedOn: "Normal",
      run: { italics: true, color: "374151" },
      paragraph: { indent: { left: 567 } },
    },
    {
      id: "Code",
      name: "Code",
      basedOn: "Normal",
      run: { font: "Consolas", size: 18 },
      paragraph: { shading: { fill: "F3F4F6" }, spacing: { after: 0 } },
    },
  ],
};

function front(document: ExportDocument, exportedOn: string): FileChild[] {
  const title = new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun(document.title)],
  });
  const subtitle =
    document.subtitle === null
      ? []
      : [new Paragraph({ children: [new TextRun({ text: document.subtitle, color: "4B5563" })] })];
  const date = new Paragraph({
    children: [new TextRun({ text: exportedOn, color: "4B5563", size: 18 })],
  });
  if (!document.isCourse) return [title, ...subtitle];
  const toc = new TableOfContents(labelsFor(document.locale).tableOfContents, {
    hyperlink: true,
    headingStyleRange: "1-2",
  });
  return [title, ...subtitle, date, new Paragraph({ children: [new PageBreak()] }), toc];
}

function section(
  entry: ExportSection,
  document: ExportDocument,
  options: DocxOptions,
  numbering: NumberingRegistry,
): FileChild[] {
  const labels = labelsFor(document.locale);
  const context = {
    images: options.images,
    numbering,
    headingOffset: document.isCourse ? 2 : 0,
    depth: 0,
    lessonUrl: entry.url,
    labels,
    contentWidth: PAGES[options.pageSize].contentWidth,
  };
  const heading = document.isCourse
    ? [
        new Paragraph({
          heading: entry.depth === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          pageBreakBefore: entry.depth === 1,
          children: [new TextRun(entry.title)],
        }),
      ]
    : [];
  return [...heading, ...docxBlocks(entry.blocks, context)];
}

function pageFooter(exportedOn: string, pageLabel: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${exportedOn} · ${pageLabel} `, size: 16, color: "6B7280" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "6B7280" }),
        ],
      }),
    ],
  });
}

/**
 * The Word file of an export (spec 10): built from structured data with
 * the `docx` library, so no user content is ever read as XML. Headings use
 * Word's heading styles, so the navigation pane and the table of contents
 * of a course work.
 */
export async function renderDocx(
  document: ExportDocument,
  options: DocxOptions,
): Promise<Uint8Array> {
  const numbering = new NumberingRegistry();
  const labels = labelsFor(document.locale);
  const exportedOn = labels.exportedOn(formatExportDate(document.exportedAt, document.locale));
  const children = [
    ...front(document, exportedOn),
    ...document.sections.flatMap((entry) => section(entry, document, options, numbering)),
  ];
  const page = PAGES[options.pageSize];
  const file = new Document({
    title: document.title,
    creator: "BeBranded e-learning",
    styles: STYLES,
    numbering: numbering.config(),
    features: { updateFields: document.isCourse },
    sections: [
      {
        properties: {
          page: {
            size: { width: page.width, height: page.height },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: document.title, size: 16, color: "6B7280" })],
              }),
            ],
          }),
        },
        footers: { default: pageFooter(exportedOn, labels.page) },
        children,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(file));
}

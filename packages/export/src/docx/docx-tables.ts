import { BorderStyle, Paragraph, ShadingType, Table, TableCell, TableRow, WidthType } from "docx";
import type { FileChild } from "docx";

import type { ExportBlock } from "@bebranded/elearning-core";

import { inlineRuns } from "./docx-inline.js";

type TableBlock = Extract<ExportBlock, { type: "table" }>;

/** A Word table; header rows repeat on every page, spans are kept. */
export function wordTable(block: TableBlock): Table {
  const rows = block.rows.map(
    (cells, index) =>
      new TableRow({
        tableHeader: index < block.headerRows,
        children: cells.map(
          (cell) =>
            new TableCell({
              columnSpan: cell.colspan,
              rowSpan: cell.rowspan,
              ...(cell.header
                ? { shading: { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" } }
                : {}),
              children: [
                new Paragraph({
                  children: inlineRuns(cell.content),
                  ...(cell.header ? { run: { bold: true } } : {}),
                }),
              ],
            }),
        ),
      }),
  );
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

const VARIANT_COLORS = {
  info: "4338CA",
  success: "15803D",
  warning: "B45309",
  danger: "B91C1C",
} as const;

/** A callout: a single shaded cell with a colored left border (spec 10, "Block mapping"). */
export function calloutTable(
  variant: keyof typeof VARIANT_COLORS,
  children: readonly FileChild[],
): Table {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const cell = new TableCell({
    shading: { type: ShadingType.CLEAR, fill: "F7F7F9", color: "auto" },
    borders: {
      top: none,
      bottom: none,
      right: none,
      left: { style: BorderStyle.SINGLE, size: 24, color: VARIANT_COLORS[variant] },
    },
    children: children.filter(
      (child): child is Paragraph | Table => child instanceof Paragraph || child instanceof Table,
    ),
  });
  return new Table({
    rows: [new TableRow({ children: [cell] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

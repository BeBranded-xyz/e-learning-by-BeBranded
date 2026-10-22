import type { InlineContent, TableContent } from "@bebranded/elearning-core";

import { element } from "./html.js";
import { renderInline } from "./render-inline.js";

type Cell = { content: InlineContent; colspan?: number | undefined; rowspan?: number | undefined };

function normalizeCells(cells: TableContent["rows"][number]["cells"]): Cell[] {
  return cells.map((cell) =>
    Array.isArray(cell)
      ? { content: cell }
      : { content: cell.content, colspan: cell.props.colspan, rowspan: cell.props.rowspan },
  );
}

function renderRow(cells: Cell[], tag: "th" | "td"): string {
  const html = cells
    .map((cell) =>
      element(
        tag,
        { colspan: cell.colspan, rowspan: cell.rowspan, scope: tag === "th" ? "col" : undefined },
        renderInline(cell.content),
      ),
    )
    .join("");
  return element("tr", {}, html);
}

export function renderTable(table: TableContent): string {
  const headerRows = table.headerRows ?? 0;
  const rows = table.rows.map((row) => normalizeCells(row.cells));
  const head = rows
    .slice(0, headerRows)
    .map((cells) => renderRow(cells, "th"))
    .join("");
  const body = rows
    .slice(headerRows)
    .map((cells) => renderRow(cells, "td"))
    .join("");
  const thead = head === "" ? "" : element("thead", {}, head);
  return element(
    "div",
    { class: "el-table-wrapper" },
    element("table", {}, thead + element("tbody", {}, body)),
  );
}

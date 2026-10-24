import type { UiTableProps } from "./kit.types.js";

/** A table with its caption, column headers and row headers (WCAG 1.3.1). */
export function DefaultTable({ caption, columns, rows }: UiTableProps) {
  return (
    <div className="el-table-wrapper">
      <table className="el-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) =>
                index === 0 ? (
                  <th key={columns[index]?.key ?? index} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={columns[index]?.key ?? index}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Synthetic lesson documents for validation tests (no real content).

export const text = (value: string, styles: Record<string, unknown> = {}) => ({
  type: "text",
  text: value,
  styles,
});
export const textProps = {
  backgroundColor: "default",
  textColor: "default",
  textAlignment: "left",
};

export function paragraph(
  id: string,
  content: unknown[] = [text("Hello")],
  children: unknown[] = [],
) {
  return { id, type: "paragraph", props: textProps, content, children };
}

/** A valid document using every allowed block type. */
export const validDocument: unknown[] = [
  {
    id: "h",
    type: "heading",
    props: { ...textProps, level: 2, isToggleable: true },
    content: [text("Title")],
    children: [paragraph("hc")],
  },
  paragraph("p", [
    text("Bold", { bold: true, textColor: "red" }),
    { type: "link", href: "mailto:training@example.com", content: [text("Write to us")] },
  ]),
  { id: "b", type: "bulletListItem", props: textProps, content: [text("Item")], children: [] },
  {
    id: "n",
    type: "numberedListItem",
    props: { ...textProps, start: 3 },
    content: [text("Step")],
    children: [],
  },
  {
    id: "c",
    type: "checkListItem",
    props: { ...textProps, checked: false },
    content: [text("Task")],
    children: [],
  },
  {
    id: "t",
    type: "toggleListItem",
    props: textProps,
    content: [text("More")],
    children: [paragraph("tc")],
  },
  {
    id: "q",
    type: "quote",
    props: { backgroundColor: "default", textColor: "default" },
    content: [text("Quote")],
    children: [],
  },
  {
    id: "k",
    type: "codeBlock",
    props: { language: "typescript" },
    content: [{ type: "text", text: "const a = 1;", styles: {} }],
    children: [],
  },
  {
    id: "tb",
    type: "table",
    props: { textColor: "default" },
    content: {
      type: "tableContent",
      columnWidths: [120, null],
      headerRows: 1,
      rows: [
        {
          cells: [
            { type: "tableCell", props: { ...textProps, colspan: 1 }, content: [text("A")] },
            { type: "tableCell", props: textProps, content: [text("B")] },
          ],
        },
        { cells: [[text("1")], [text("2")]] },
      ],
    },
    children: [],
  },
  { id: "d", type: "divider", props: {}, children: [] },
  {
    id: "co",
    type: "callout",
    props: { backgroundColor: "default", textColor: "default", variant: "danger" },
    content: [text("Careful")],
    children: [],
  },
];

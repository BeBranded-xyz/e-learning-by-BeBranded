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

export const FILE_ID = "6f1c2a4e-1b7d-4c3a-9f2e-0a1b2c3d4e5f";
export const OTHER_FILE_ID = "0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70";

export function imageBlock(id: string, url: string, props: Record<string, unknown> = {}) {
  return {
    id,
    type: "image",
    props: {
      textAlignment: "left",
      backgroundColor: "default",
      name: "diagram.png",
      url,
      caption: "",
      showPreview: true,
      ...props,
    },
    children: [],
  };
}

export function fileBlock(id: string, url: string, props: Record<string, unknown> = {}) {
  return {
    id,
    type: "file",
    props: { backgroundColor: "default", name: "handbook.pdf", url, caption: "", ...props },
    children: [],
  };
}

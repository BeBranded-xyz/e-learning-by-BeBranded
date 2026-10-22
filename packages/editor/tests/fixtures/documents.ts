import type { LessonDocument, StyledText, TextStyles } from "@bebranded/elearning-core";

const text = (value: string, styles: TextStyles = {}): StyledText => ({
  type: "text",
  text: value,
  styles,
});
const plain = (value: string) => ({ type: "text" as const, text: value, styles: {} });
const colors = { backgroundColor: "default", textColor: "default" } as const;
const textProps = { ...colors, textAlignment: "left" } as const;

/** One block of every allowed type, with synthetic content only. */
export const everyBlock: LessonDocument = [
  {
    id: "h1",
    type: "heading",
    props: { ...textProps, level: 1 },
    content: [text("Safety basics")],
    children: [],
  },
  {
    id: "p1",
    type: "paragraph",
    props: textProps,
    content: [
      text("Read the "),
      text("procedure", { bold: true }),
      text(" and "),
      { type: "link", href: "https://example.com/guide", content: [text("the guide")] },
      text("."),
    ],
    children: [],
  },
  {
    id: "b1",
    type: "bulletListItem",
    props: textProps,
    content: [text("First point")],
    children: [],
  },
  {
    id: "n1",
    type: "numberedListItem",
    props: textProps,
    content: [text("Step one")],
    children: [],
  },
  {
    id: "c1",
    type: "checkListItem",
    props: { ...textProps, checked: true },
    content: [text("Done")],
    children: [],
  },
  {
    id: "t1",
    type: "toggleListItem",
    props: textProps,
    content: [text("Details")],
    children: [
      {
        id: "t1c",
        type: "paragraph",
        props: textProps,
        content: [text("Hidden text")],
        children: [],
      },
    ],
  },
  { id: "q1", type: "quote", props: colors, content: [text("Safety first.")], children: [] },
  {
    id: "k1",
    type: "codeBlock",
    props: { language: "bash" },
    content: [plain("echo <hello>")],
    children: [],
  },
  {
    id: "tb1",
    type: "table",
    props: { textColor: "default" },
    content: {
      type: "tableContent",
      columnWidths: [null, null],
      rows: [{ cells: [[text("Name")], [text("Value")]] }, { cells: [[text("A")], [text("1")]] }],
    },
    children: [],
  },
  { id: "d1", type: "divider", props: {}, children: [] },
  {
    id: "co1",
    type: "callout",
    props: { ...colors, variant: "warning" },
    content: [text("Wear gloves.")],
    children: [],
  },
];

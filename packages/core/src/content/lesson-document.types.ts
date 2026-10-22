/**
 * Types of the lesson document (a subset of BlockNote JSON). Written out
 * because the compiler cannot serialize the inferred type of the recursive
 * schema; `lessonBlockSchema` is annotated with them, so the two cannot drift.
 * Optional fields allow `undefined` because Zod's `.optional()` produces it.
 */

export type Color =
  "default" | "gray" | "brown" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";
type TextAlignment = "left" | "center" | "right" | "justify";
export type CalloutVariant = "info" | "success" | "warning" | "danger";

export type TextStyles = {
  bold?: true | undefined;
  italic?: true | undefined;
  underline?: true | undefined;
  strike?: true | undefined;
  code?: true | undefined;
  textColor?: Color | undefined;
  backgroundColor?: Color | undefined;
};

export type StyledText = { type: "text"; text: string; styles: TextStyles };
export type LinkContent = { type: "link"; href: string; content: StyledText[] };
export type InlineContent = (StyledText | LinkContent)[];
type PlainContent = { type: "text"; text: string; styles: Record<string, never> }[];

type ColorProps = { backgroundColor: Color; textColor: Color };
type TextProps = ColorProps & { textAlignment: TextAlignment };

type TableCell = {
  type: "tableCell";
  props: TextProps & { colspan?: number | undefined; rowspan?: number | undefined };
  content: InlineContent;
};

export type TableContent = {
  type: "tableContent";
  columnWidths: (number | null)[];
  headerRows?: number | undefined;
  headerCols?: number | undefined;
  rows: { cells: TableCell[] | InlineContent[] }[];
};

type Block<T extends string, P, C> = {
  id: string;
  type: T;
  props: P;
  content: C;
  children: LessonBlock[];
};

export type LessonBlock =
  | Block<"paragraph", TextProps, InlineContent>
  | Block<
      "heading",
      TextProps & { level: 1 | 2 | 3; isToggleable?: boolean | undefined },
      InlineContent
    >
  | Block<"bulletListItem", TextProps, InlineContent>
  | Block<"numberedListItem", TextProps & { start?: number | undefined }, InlineContent>
  | Block<"checkListItem", TextProps & { checked: boolean }, InlineContent>
  | Block<"toggleListItem", TextProps, InlineContent>
  | Block<"quote", ColorProps, InlineContent>
  | Block<"codeBlock", { language: string }, PlainContent>
  | Block<"table", { textColor: Color }, TableContent>
  | (Omit<Block<"divider", Record<string, never>, undefined>, "content"> & { content?: undefined })
  | Block<"callout", ColorProps & { variant: CalloutVariant }, InlineContent>;

export type LessonDocument = LessonBlock[];

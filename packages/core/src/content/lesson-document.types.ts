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

/** Blocks without inline content (BlockNote's `content: "none"`). */
type ContentlessBlock<T extends string, P> = Omit<Block<T, P, undefined>, "content"> & {
  content?: undefined;
};

/** One column of a column list: any blocks except another column list (spec 10). */
export type ColumnBlock = {
  id: string;
  type: "column";
  /** A share of the row; the shares of a list are normalized to sum to 1. */
  props: { width: number };
  content?: undefined;
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
  | ContentlessBlock<"divider", Record<string, never>>
  | Block<"callout", ColorProps & { variant: CalloutVariant }, InlineContent>
  | ContentlessBlock<
      "image",
      {
        textAlignment: TextAlignment;
        backgroundColor: Color;
        name: string;
        url: string;
        caption: string;
        showPreview: boolean;
        previewWidth?: number | undefined;
      }
    >
  | ContentlessBlock<"file", { backgroundColor: Color; name: string; url: string; caption: string }>
  | {
      id: string;
      type: "columnList";
      props: Record<string, never>;
      content?: undefined;
      children: ColumnBlock[];
    };

export type LessonDocument = LessonBlock[];

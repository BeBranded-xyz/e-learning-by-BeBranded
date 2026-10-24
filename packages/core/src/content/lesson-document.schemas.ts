import { z } from "zod";

import { fileIdSchema } from "./ids.js";
import type { ColumnBlock, LessonBlock } from "./lesson-document.types.js";

/**
 * The subset of BlockNote JSON that lesson content may contain (spec 08,
 * "Rich content"). Unknown block types, props and fields are rejected.
 * Image and file blocks only point to files uploaded through the module
 * (`elearning-file:<id>`); audio and video blocks stay rejected (video
 * lessons carry videos).
 */

export const LESSON_DOCUMENT_LIMITS = {
  maxBytes: 512_000,
  maxBlocks: 2_000,
  maxDepth: 6,
  maxTextLength: 20_000,
  maxTableCells: 1_000,
} as const;

export const ALLOWED_URL_PROTOCOLS = ["https:", "http:", "mailto:"] as const;

/** The color names of BlockNote's palette; arbitrary CSS values are not accepted. */
export const colorSchema = z.enum([
  "default",
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
]);
const alignmentSchema = z.enum(["left", "center", "right", "justify"]);

export const safeUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    return (ALLOWED_URL_PROTOCOLS as readonly string[]).includes(new URL(value).protocol);
  }, "Only https, http and mailto links are allowed");

/** How a lesson document points to an uploaded file; resolved to a signed URL when rendered. */
export const FILE_URL_PREFIX = "elearning-file:";

export const fileUrlSchema = z
  .string()
  .max(FILE_URL_PREFIX.length + 36)
  .refine(
    (value) =>
      value.startsWith(FILE_URL_PREFIX) &&
      fileIdSchema.safeParse(value.slice(FILE_URL_PREFIX.length)).success,
    "Images and files must be uploaded through the module",
  );

/** An empty url is a media block whose upload has not finished; it renders nothing. */
const mediaUrlSchema = z.union([z.literal(""), fileUrlSchema]);
const fileNameSchema = z.string().max(255);
const captionSchema = z.string().max(1_000);

const stylesSchema = z.strictObject({
  bold: z.literal(true).optional(),
  italic: z.literal(true).optional(),
  underline: z.literal(true).optional(),
  strike: z.literal(true).optional(),
  code: z.literal(true).optional(),
  textColor: colorSchema.optional(),
  backgroundColor: colorSchema.optional(),
});

const textSchema = z.string().max(LESSON_DOCUMENT_LIMITS.maxTextLength);

const styledTextSchema = z.strictObject({
  type: z.literal("text"),
  text: textSchema,
  styles: stylesSchema,
});

const linkSchema = z.strictObject({
  type: z.literal("link"),
  href: safeUrlSchema,
  content: z.array(styledTextSchema).max(100),
});

export const inlineContentSchema = z
  .array(z.discriminatedUnion("type", [styledTextSchema, linkSchema]))
  .max(500);
const plainContentSchema = z
  .array(styledTextSchema.extend({ styles: z.strictObject({}) }))
  .max(500);

const colorProps = { backgroundColor: colorSchema, textColor: colorSchema };
const textProps = { ...colorProps, textAlignment: alignmentSchema };

const tableCellSchema = z.strictObject({
  type: z.literal("tableCell"),
  props: z.strictObject({
    ...textProps,
    colspan: z.int().min(1).max(50).optional(),
    rowspan: z.int().min(1).max(50).optional(),
  }),
  content: inlineContentSchema,
});

const tableContentSchema = z.strictObject({
  type: z.literal("tableContent"),
  columnWidths: z.array(z.number().positive().max(10_000).nullable()).max(50),
  headerRows: z.int().min(0).max(50).optional(),
  headerCols: z.int().min(0).max(50).optional(),
  rows: z
    .array(
      z.strictObject({
        cells: z.union([z.array(tableCellSchema).max(50), z.array(inlineContentSchema).max(50)]),
      }),
    )
    .max(200),
});

const blockId = z.string().min(1).max(64);
const childrenSchema = z
  .array(z.lazy((): z.ZodType<LessonBlock> => lessonBlockSchema))
  .max(LESSON_DOCUMENT_LIMITS.maxBlocks);

function block<T extends string, P extends z.ZodRawShape, C extends z.ZodType>(
  type: T,
  props: P,
  content: C,
) {
  return z.strictObject({
    id: blockId,
    type: z.literal(type),
    props: z.strictObject(props),
    content,
    children: childrenSchema,
  });
}

export const calloutVariantSchema = z.enum(["info", "success", "warning", "danger"]);
const headingLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** 2 to 4 columns per list, each at least 15% of the row once normalized (spec 10). */
export const COLUMN_RULES = { min: 2, max: 4, minShare: 0.15 } as const;

const columnSchema: z.ZodType<ColumnBlock> = z.strictObject({
  id: blockId,
  type: z.literal("column"),
  props: z.strictObject({ width: z.number().positive().max(1_000) }),
  content: z.undefined().optional(),
  children: childrenSchema,
});

const columnListSchema = z
  .strictObject({
    id: blockId,
    type: z.literal("columnList"),
    props: z.strictObject({}),
    content: z.undefined().optional(),
    children: z.array(columnSchema).min(COLUMN_RULES.min).max(COLUMN_RULES.max),
  })
  .refine(
    (list) => {
      const total = list.children.reduce((sum, column) => sum + column.props.width, 0);
      return list.children.every(
        (column) => column.props.width / total >= COLUMN_RULES.minShare - 1e-9,
      );
    },
    { message: "Each column takes at least 15% of the row", path: ["children"] },
  );

export const lessonBlockSchema: z.ZodType<LessonBlock> = z.discriminatedUnion("type", [
  block("paragraph", textProps, inlineContentSchema),
  block(
    "heading",
    { ...textProps, level: headingLevelSchema, isToggleable: z.boolean().optional() },
    inlineContentSchema,
  ),
  block("bulletListItem", textProps, inlineContentSchema),
  block(
    "numberedListItem",
    { ...textProps, start: z.int().min(0).max(100_000).optional() },
    inlineContentSchema,
  ),
  block("checkListItem", { ...textProps, checked: z.boolean() }, inlineContentSchema),
  block("toggleListItem", textProps, inlineContentSchema),
  block("quote", colorProps, inlineContentSchema),
  block("codeBlock", { language: z.string().regex(/^[a-z0-9+#-]{0,30}$/) }, plainContentSchema),
  block("table", { textColor: colorSchema }, tableContentSchema),
  block("divider", {}, z.undefined().optional()),
  block("callout", { ...colorProps, variant: calloutVariantSchema }, inlineContentSchema),
  block(
    "image",
    {
      textAlignment: alignmentSchema,
      backgroundColor: colorSchema,
      name: fileNameSchema,
      url: mediaUrlSchema,
      caption: captionSchema,
      showPreview: z.boolean(),
      previewWidth: z.int().min(1).max(10_000).optional(),
    },
    z.undefined().optional(),
  ),
  block(
    "file",
    {
      backgroundColor: colorSchema,
      name: fileNameSchema,
      url: mediaUrlSchema,
      caption: captionSchema,
    },
    z.undefined().optional(),
  ),
  columnListSchema,
]);

export const lessonDocumentSchema = z
  .array(lessonBlockSchema)
  .max(LESSON_DOCUMENT_LIMITS.maxBlocks);

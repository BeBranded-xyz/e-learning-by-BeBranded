import { err, ok } from "../result.js";
import { MAX_JSON_NESTING, measureJson } from "./json-size.js";
import type { Result } from "../result.js";
import { LESSON_DOCUMENT_LIMITS, lessonDocumentSchema } from "./lesson-document.schemas.js";
import type { LessonDocument } from "./lesson-document.types.js";

export type ContentIssueCode =
  | "too_large"
  | "too_deep"
  | "too_many_blocks"
  | "too_many_table_cells"
  | "duplicate_block_id"
  | "invalid_content";

export type ContentIssue = {
  readonly code: ContentIssueCode;
  readonly message: string;
  /** Path to the offending value, e.g. `[0, "children", 2, "props", "level"]`. */
  readonly path: readonly (string | number)[];
};

type Shape = {
  readonly blocks: number;
  readonly depth: number;
  readonly cells: number;
  readonly ids: string[];
};

function childrenOf(value: unknown): unknown[] {
  if (typeof value !== "object" || value === null || !("children" in value)) return [];
  return Array.isArray(value.children) ? value.children : [];
}

function cellCount(value: unknown): number {
  if (typeof value !== "object" || value === null || !("content" in value)) return 0;
  const content = value.content;
  if (
    typeof content !== "object" ||
    content === null ||
    !("rows" in content) ||
    !Array.isArray(content.rows)
  )
    return 0;
  return content.rows.reduce((total: number, row: unknown) => {
    const cells = typeof row === "object" && row !== null && "cells" in row ? row.cells : [];
    return total + (Array.isArray(cells) ? cells.length : 0);
  }, 0);
}

function idOf(value: unknown): string | undefined {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
    ? value.id
    : undefined;
}

/**
 * Measures the raw document iteratively, before schema parsing, so a hostile
 * document cannot exhaust the stack or the CPU of the recursive parser.
 */
function measure(input: unknown[]): Shape {
  const stack = input.map((node) => ({ node, depth: 1 }));
  let blocks = 0;
  let depth = 0;
  let cells = 0;
  const ids: string[] = [];
  const withinLimits = () =>
    blocks <= LESSON_DOCUMENT_LIMITS.maxBlocks && depth <= LESSON_DOCUMENT_LIMITS.maxDepth;
  for (let current = stack.pop(); current !== undefined && withinLimits(); current = stack.pop()) {
    blocks += 1;
    depth = Math.max(depth, current.depth);
    cells += cellCount(current.node);
    const id = idOf(current.node);
    if (id !== undefined) ids.push(id);
    for (const child of childrenOf(current.node))
      stack.push({ node: child, depth: current.depth + 1 });
  }
  return { blocks, depth, cells, ids };
}

function limitIssue(shape: Shape): ContentIssue | null {
  const { maxBlocks, maxDepth, maxTableCells } = LESSON_DOCUMENT_LIMITS;
  if (shape.blocks > maxBlocks)
    return { code: "too_many_blocks", message: `At most ${maxBlocks} blocks`, path: [] };
  if (shape.depth > maxDepth)
    return { code: "too_deep", message: `At most ${maxDepth} nesting levels`, path: [] };
  if (shape.cells > maxTableCells) {
    return {
      code: "too_many_table_cells",
      message: `At most ${maxTableCells} table cells`,
      path: [],
    };
  }
  const duplicate = shape.ids.find((id, index) => shape.ids.indexOf(id) !== index);
  return duplicate === undefined
    ? null
    : { code: "duplicate_block_id", message: "Block ids must be unique", path: [] };
}

/**
 * Validates lesson content before it is stored (spec 08): size, depth, block
 * count and table size first, then the strict block schema.
 */
export function validateLessonDocument(input: unknown): Result<LessonDocument, ContentIssue[]> {
  const size = measureJson(input, LESSON_DOCUMENT_LIMITS.maxBytes);
  if (size.kind === "too_large") {
    return err([
      { code: "too_large", message: `At most ${LESSON_DOCUMENT_LIMITS.maxBytes} bytes`, path: [] },
    ]);
  }
  if (size.kind === "too_deep") {
    return err([
      { code: "too_deep", message: `At most ${MAX_JSON_NESTING} nested JSON values`, path: [] },
    ]);
  }
  if (!Array.isArray(input)) {
    return err([
      { code: "invalid_content", message: "A lesson document is an array of blocks", path: [] },
    ]);
  }
  const issue = limitIssue(measure(input));
  if (issue !== null) return err([issue]);
  const parsed = lessonDocumentSchema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err(
    parsed.error.issues.slice(0, 20).map((zodIssue) => ({
      code: "invalid_content" as const,
      message: zodIssue.message,
      path: zodIssue.path.filter((segment) => typeof segment !== "symbol"),
    })),
  );
}

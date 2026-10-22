import { BlockNoteSchema } from "@blocknote/core";

import { createCalloutBlock } from "./blocks/callout.js";

/**
 * The module's block schema: BlockNote's default blocks plus our callout.
 *
 * The server-side validator (`validateLessonDocument` in elearning-core) is
 * the source of truth for what a lesson may contain: it rejects headings
 * below level 3 and the media blocks (image, file, audio, video) until file
 * uploads exist. The authoring menu (phase 4) hides what it rejects.
 * `BlockNoteSchema.create({ blockSpecs })` with a subset of the default specs
 * does not type-check under `exactOptionalPropertyTypes`; `extend` does.
 */
export const lessonEditorSchema = BlockNoteSchema.create().extend({
  blockSpecs: { callout: createCalloutBlock() },
});

export type LessonEditorSchema = typeof lessonEditorSchema;

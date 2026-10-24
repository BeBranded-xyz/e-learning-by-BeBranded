import { BlockNoteSchema } from "@blocknote/core";

import { createCalloutBlock } from "./blocks/callout.js";
import { createColumn, createColumnList } from "./blocks/columns.js";
import {
  createMatchingQuestion,
  createMultipleChoiceQuestion,
  createOrderingQuestion,
  createQuizAnswer,
  createQuizChoice,
  createQuizItem,
  createQuizPair,
  createShortAnswerQuestion,
  createSingleChoiceQuestion,
  createTrueFalseQuestion,
} from "./blocks/quiz-blocks.js";

/**
 * The module's block schemas: BlockNote's default blocks plus our callout.
 *
 * The server-side validator (`validateLessonDocument` in elearning-core) is
 * the source of truth for what a lesson may contain: it rejects headings
 * below level 3, audio and video blocks, and images or files that were not
 * uploaded through the module. The admin editor's menu hides what it rejects.
 * `BlockNoteSchema.create({ blockSpecs })` with a subset of the default specs
 * does not type-check under `exactOptionalPropertyTypes`; `extend` does.
 *
 * Each schema gets a fresh base: BlockNote's `extend` adds to the schema it
 * is called on, so two schemas extending one base would share every block.
 */
const contentSchema = () =>
  BlockNoteSchema.create().extend({ blockSpecs: { callout: createCalloutBlock() } });

export type LessonEditorSchemaOptions = {
  /** The column resize handle's accessible name; English by default. */
  readonly columnResizeLabel?: string;
};

/** Lessons also lay blocks out in 2 to 4 columns (spec 10, ADR-0001). */
export function createLessonEditorSchema(options: LessonEditorSchemaOptions = {}) {
  const column =
    options.columnResizeLabel === undefined
      ? createColumn()
      : createColumn({ resizeLabel: options.columnResizeLabel });
  return contentSchema().extend({ blockSpecs: { columnList: createColumnList(), column } });
}

/** The lesson schema with English labels. */
export const lessonEditorSchema = createLessonEditorSchema();

export type LessonEditorSchema = typeof lessonEditorSchema;

/**
 * The quiz editor's schema: the lesson blocks except columns, which give
 * context between questions, plus the question blocks and their option blocks (spec 07).
 * `editorDocumentToQuiz` in elearning-core validates what it produces.
 */
export const quizEditorSchema = contentSchema().extend({
  blockSpecs: {
    singleChoiceQuestion: createSingleChoiceQuestion(),
    multipleChoiceQuestion: createMultipleChoiceQuestion(),
    trueFalseQuestion: createTrueFalseQuestion(),
    shortAnswerQuestion: createShortAnswerQuestion(),
    orderingQuestion: createOrderingQuestion(),
    matchingQuestion: createMatchingQuestion(),
    quizChoice: createQuizChoice(),
    quizAnswer: createQuizAnswer(),
    quizItem: createQuizItem(),
    quizPair: createQuizPair(),
  },
});

export type QuizEditorSchema = typeof quizEditorSchema;

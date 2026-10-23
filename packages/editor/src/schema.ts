import { BlockNoteSchema } from "@blocknote/core";

import { createCalloutBlock } from "./blocks/callout.js";
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

/**
 * The quiz editor's schema: the lesson blocks, which give context between
 * questions, plus the question blocks and their option blocks (spec 07).
 * `editorDocumentToQuiz` in elearning-core validates what it produces.
 */
export const quizEditorSchema = lessonEditorSchema.extend({
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

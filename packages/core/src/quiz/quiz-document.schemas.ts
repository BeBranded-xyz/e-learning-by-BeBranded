import { z } from "zod";

import { inlineContentSchema } from "../content/lesson-document.schemas.js";
import { QUIZ_LIMITS } from "./quiz.schemas.js";

/**
 * Question blocks of the quiz editor (spec 07, "Authoring"): BlockNote JSON,
 * one custom block per question type, with the options as child blocks.
 * Regular lesson blocks may sit between questions.
 */

const blockId = z.string().min(1).max(64);

function child<T extends string, P extends z.ZodRawShape>(type: T, props: P) {
  return z.strictObject({
    id: blockId,
    type: z.literal(type),
    props: z.strictObject(props),
    content: inlineContentSchema,
    children: z.array(z.never()).max(0),
  });
}

const choiceBlock = child("quizChoice", { correct: z.boolean() });
const answerBlock = child("quizAnswer", {});
const itemBlock = child("quizItem", {});
const pairBlock = child("quizPair", {
  match: z.string().max(QUIZ_LIMITS.maxOptionLength),
});

const questionProps = {
  points: z.int().min(1).max(QUIZ_LIMITS.maxPoints),
  explanation: z.string().max(QUIZ_LIMITS.maxExplanationLength),
};

function question<T extends string, P extends z.ZodRawShape, C extends z.ZodType>(
  type: T,
  props: P,
  children: C,
) {
  return z.strictObject({
    id: blockId,
    type: z.literal(type),
    props: z.strictObject({ ...questionProps, ...props }),
    content: inlineContentSchema,
    children: z.array(children).max(QUIZ_LIMITS.maxOptions),
  });
}

export const questionBlockSchema = z.discriminatedUnion("type", [
  question("singleChoiceQuestion", {}, choiceBlock),
  question("multipleChoiceQuestion", { partialCredit: z.boolean() }, choiceBlock),
  question("trueFalseQuestion", { answer: z.boolean() }, z.never()),
  question("shortAnswerQuestion", {}, answerBlock),
  question("orderingQuestion", {}, itemBlock),
  question("matchingQuestion", {}, pairBlock),
]);
export type QuestionBlock = z.infer<typeof questionBlockSchema>;
export type QuestionBlockType = QuestionBlock["type"];

export const QUESTION_BLOCK_TYPES: readonly QuestionBlockType[] = questionBlockSchema.options.map(
  (option) => option.shape.type.value,
);

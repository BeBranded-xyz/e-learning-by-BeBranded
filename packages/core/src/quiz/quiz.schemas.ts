import { z } from "zod";

import { lessonDocumentSchema } from "../content/lesson-document.schemas.js";

/** Bounds of a quiz (spec 07, spec 08 "Rich content"). */
export const QUIZ_LIMITS = {
  maxQuestions: 200,
  maxOptions: 20,
  maxPromptLength: 2_000,
  maxOptionLength: 500,
  maxExplanationLength: 2_000,
  maxPoints: 100,
  maxShortAnswerLength: 500,
} as const;

export const showCorrectionSchema = z.enum(["never", "after_attempt", "after_pass"]);
export type ShowCorrection = z.infer<typeof showCorrectionSchema>;

/** Per-lesson options of a quiz lesson (spec 07, "Attempts"). */
export const quizLessonSettingsSchema = z.strictObject({
  /** Share of the points needed to pass, between 0 and 1. */
  passingScore: z.number().min(0).max(1).default(0.8),
  /** Null for unlimited attempts. */
  maxAttempts: z.int().min(1).max(100).nullable().default(null),
  cooldownMinutes: z.int().min(0).max(10_080).default(0),
  /** Null for no time limit. */
  timeLimitMinutes: z.int().min(1).max(600).nullable().default(null),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  /** Answers shown after every attempt make a second attempt trivial, hence the default. */
  showCorrection: showCorrectionSchema.default("after_pass"),
});
export type QuizLessonSettings = z.infer<typeof quizLessonSettingsSchema>;

const idSchema = z.string().min(1).max(64);
const optionTextSchema = z.string().min(1).max(QUIZ_LIMITS.maxOptionLength);
const optionSchema = z.strictObject({ id: idSchema, text: optionTextSchema });
const optionsSchema = z.array(optionSchema).min(2).max(QUIZ_LIMITS.maxOptions);

const common = {
  id: idSchema,
  prompt: z.string().min(1).max(QUIZ_LIMITS.maxPromptLength),
  points: z.int().min(1).max(QUIZ_LIMITS.maxPoints),
  explanation: z.string().max(QUIZ_LIMITS.maxExplanationLength),
  /** Context blocks shown just before the question; they move with it when shuffled. */
  intro: lessonDocumentSchema,
};

export const quizQuestionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("single_choice"),
    options: optionsSchema,
    correctOptionId: idSchema,
  }),
  z.strictObject({
    ...common,
    kind: z.literal("multiple_choice"),
    options: optionsSchema,
    correctOptionIds: z.array(idSchema).min(1).max(QUIZ_LIMITS.maxOptions),
    /** Correct ticks minus wrong ticks, floored at 0, instead of all-or-nothing. */
    partialCredit: z.boolean(),
  }),
  z.strictObject({ ...common, kind: z.literal("true_false"), answer: z.boolean() }),
  z.strictObject({
    ...common,
    kind: z.literal("short_answer"),
    acceptedAnswers: z.array(optionTextSchema).min(1).max(QUIZ_LIMITS.maxOptions),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("ordering"),
    /** In the correct order. */
    items: optionsSchema,
  }),
  z.strictObject({
    ...common,
    kind: z.literal("matching"),
    pairs: z
      .array(z.strictObject({ id: idSchema, left: optionTextSchema, right: optionTextSchema }))
      .min(2)
      .max(QUIZ_LIMITS.maxOptions),
  }),
]);
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizQuestionKind = QuizQuestion["kind"];

/**
 * The graded form of a quiz, derived from the editor document on save
 * (`editorDocumentToQuiz`). It holds the correct answers: it never leaves
 * the server as is; learners get `toSurveyJson(presentQuiz(...))`.
 */
export const quizDefinitionSchema = z.strictObject({
  questions: z.array(quizQuestionSchema).min(1).max(QUIZ_LIMITS.maxQuestions),
  /** Context blocks after the last question. */
  outro: lessonDocumentSchema,
});
export type QuizDefinition = z.infer<typeof quizDefinitionSchema>;

/** A presented question's name in the survey: `q1`, `q2`… in the order shown. */
export const QUESTION_NAME = /^q[1-9]\d{0,2}$/;
const valueSchema = z.string().regex(/^[a-z]\d{1,2}$/);

/**
 * Raw answers posted by the learner, in the shape SurveyJS produces, keyed
 * by question name. Values the presentation does not know are graded as
 * wrong; unanswered questions earn nothing.
 */
export const quizAnswersSchema = z
  .record(
    z.string().regex(QUESTION_NAME),
    z.union([
      z.string().max(QUIZ_LIMITS.maxShortAnswerLength),
      z.boolean(),
      z.array(valueSchema).max(QUIZ_LIMITS.maxOptions),
      z.record(valueSchema, valueSchema),
    ]),
  )
  .refine((answers) => Object.keys(answers).length <= QUIZ_LIMITS.maxQuestions, {
    message: `At most ${QUIZ_LIMITS.maxQuestions} answers`,
  });
export type QuizAnswers = z.infer<typeof quizAnswersSchema>;

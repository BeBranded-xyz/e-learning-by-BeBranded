import type { PartialBlock } from "@blocknote/core";

import type { QuizEditorSchema } from "@bebranded/elearning-editor";

export const QUESTION_TYPES = [
  "singleChoiceQuestion",
  "multipleChoiceQuestion",
  "trueFalseQuestion",
  "shortAnswerQuestion",
  "orderingQuestion",
  "matchingQuestion",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

type QuizBlock = PartialBlock<
  QuizEditorSchema["blockSchema"],
  QuizEditorSchema["inlineContentSchema"],
  QuizEditorSchema["styleSchema"]
>;

const option = (type: "quizChoice" | "quizAnswer" | "quizItem", text: string): QuizBlock => ({
  type,
  content: text,
});

/**
 * A new question with placeholder options, so the author edits rather than
 * builds. Correct answers are set in the question panel; the server checks
 * the result (`editorDocumentToQuiz`).
 */
export function questionTemplate(type: QuestionType): QuizBlock {
  switch (type) {
    case "singleChoiceQuestion":
    case "multipleChoiceQuestion":
      return {
        type,
        children: [option("quizChoice", "Option 1"), option("quizChoice", "Option 2")],
      };
    case "trueFalseQuestion":
      return { type };
    case "shortAnswerQuestion":
      return { type, children: [option("quizAnswer", "Answer")] };
    case "orderingQuestion":
      return {
        type,
        children: ["First", "Second", "Third"].map((text) => option("quizItem", text)),
      };
    case "matchingQuestion":
      return {
        type,
        children: [
          { type: "quizPair", content: "Left 1", props: { match: "Right 1" } },
          { type: "quizPair", content: "Left 2", props: { match: "Right 2" } },
        ],
      };
  }
}

const QUESTION_SET: ReadonlySet<string> = new Set(QUESTION_TYPES);

export function isQuestionType(type: string): type is QuestionType {
  return QUESTION_SET.has(type);
}

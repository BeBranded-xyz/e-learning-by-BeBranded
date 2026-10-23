import { createBlockSpec } from "@blocknote/core";

/**
 * Question blocks of the quiz editor (spec 07, "Authoring"). The block text
 * is the prompt; options are child blocks. Their JSON is validated, and
 * converted to the graded definition, by `editorDocumentToQuiz` in
 * elearning-core: these specs only give the editor the same shape.
 */

const questionProps = {
  points: { default: 1 },
  explanation: { default: "" },
};

const QUESTION_LABELS = {
  singleChoiceQuestion: "Single choice",
  multipleChoiceQuestion: "Multiple choice",
  trueFalseQuestion: "True or false",
  shortAnswerQuestion: "Short answer",
  orderingQuestion: "Ordering",
  matchingQuestion: "Matching",
} as const;

type QuestionType = keyof typeof QUESTION_LABELS;

/** A labelled box whose editable content is the prompt; BlockNote renders the options below it. */
function renderQuestion(type: QuestionType) {
  const dom = document.createElement("div");
  dom.className = "el-quiz-question";
  dom.dataset.questionType = type;
  const label = document.createElement("span");
  label.className = "el-quiz-question-type";
  label.contentEditable = "false";
  label.textContent = QUESTION_LABELS[type];
  const contentDOM = document.createElement("div");
  contentDOM.className = "el-quiz-question-prompt";
  dom.append(label, contentDOM);
  return { dom, contentDOM };
}

function renderOption(className: string, data: Record<string, string> = {}) {
  const dom = document.createElement("div");
  dom.className = className;
  Object.assign(dom.dataset, data);
  const contentDOM = document.createElement("div");
  dom.append(contentDOM);
  return { dom, contentDOM };
}

export const createSingleChoiceQuestion = createBlockSpec(
  { type: "singleChoiceQuestion", propSchema: questionProps, content: "inline" },
  { render: () => renderQuestion("singleChoiceQuestion") },
);

export const createMultipleChoiceQuestion = createBlockSpec(
  {
    type: "multipleChoiceQuestion",
    propSchema: { ...questionProps, partialCredit: { default: false } },
    content: "inline",
  },
  { render: () => renderQuestion("multipleChoiceQuestion") },
);

export const createTrueFalseQuestion = createBlockSpec(
  {
    type: "trueFalseQuestion",
    propSchema: { ...questionProps, answer: { default: true } },
    content: "inline",
  },
  { render: () => renderQuestion("trueFalseQuestion") },
);

export const createShortAnswerQuestion = createBlockSpec(
  { type: "shortAnswerQuestion", propSchema: questionProps, content: "inline" },
  { render: () => renderQuestion("shortAnswerQuestion") },
);

export const createOrderingQuestion = createBlockSpec(
  { type: "orderingQuestion", propSchema: questionProps, content: "inline" },
  { render: () => renderQuestion("orderingQuestion") },
);

export const createMatchingQuestion = createBlockSpec(
  { type: "matchingQuestion", propSchema: questionProps, content: "inline" },
  { render: () => renderQuestion("matchingQuestion") },
);

/** A choice of a single or multiple choice question; `correct` marks the right ones. */
export const createQuizChoice = createBlockSpec(
  { type: "quizChoice", propSchema: { correct: { default: false } }, content: "inline" },
  {
    render: (block) => renderOption("el-quiz-choice", { correct: String(block.props.correct) }),
  },
);

/** An accepted answer of a short answer question. */
export const createQuizAnswer = createBlockSpec(
  { type: "quizAnswer", propSchema: {}, content: "inline" },
  { render: () => renderOption("el-quiz-answer") },
);

/** An item of an ordering question; items are written in the correct order. */
export const createQuizItem = createBlockSpec(
  { type: "quizItem", propSchema: {}, content: "inline" },
  { render: () => renderOption("el-quiz-item") },
);

/** A pair of a matching question: the block text is the left side, `match` the right side. */
export const createQuizPair = createBlockSpec(
  { type: "quizPair", propSchema: { match: { default: "" } }, content: "inline" },
  { render: (block) => renderOption("el-quiz-pair", { match: block.props.match }) },
);

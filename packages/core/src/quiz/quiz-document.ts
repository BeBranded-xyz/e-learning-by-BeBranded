import { lessonBlockSchema } from "../content/lesson-document.schemas.js";
import type { InlineContent, LessonBlock } from "../content/lesson-document.types.js";
import { precheckDocument, schemaIssues } from "../content/lesson-document.js";
import type { ContentIssue } from "../content/lesson-document.js";
import { err, ok } from "../result.js";
import type { Result } from "../result.js";
import { QUESTION_BLOCK_TYPES, questionBlockSchema } from "./quiz-document.schemas.js";
import type { QuestionBlock } from "./quiz-document.schemas.js";
import { QUIZ_LIMITS, quizDefinitionSchema } from "./quiz.schemas.js";
import type { QuizDefinition, QuizQuestion } from "./quiz.schemas.js";

/** The quiz editor's document: lesson blocks and question blocks, in reading order. */
export type QuizDocument = readonly (LessonBlock | QuestionBlock)[];

const isQuestionType = (type: unknown): boolean =>
  (QUESTION_BLOCK_TYPES as readonly unknown[]).includes(type);

const isQuestionBlock = (block: LessonBlock | QuestionBlock): block is QuestionBlock =>
  isQuestionType(block.type);

/** The prompt and options are plain text in the survey; formatting is dropped. */
export function plainText(content: InlineContent): string {
  return content
    .map((node) => (node.type === "text" ? node.text : node.content.map((t) => t.text).join("")))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBlocks(input: readonly unknown[]): Result<QuizDocument, ContentIssue[]> {
  const blocks: (LessonBlock | QuestionBlock)[] = [];
  for (const [index, raw] of input.entries()) {
    const type = typeof raw === "object" && raw !== null && "type" in raw ? raw.type : undefined;
    const parsed = isQuestionType(type)
      ? questionBlockSchema.safeParse(raw)
      : lessonBlockSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        schemaIssues(parsed.error).map((issue) => ({ ...issue, path: [index, ...issue.path] })),
      );
    }
    blocks.push(parsed.data);
  }
  return ok(blocks);
}

const options = (block: QuestionBlock) =>
  block.children.map((option) => ({ id: option.id, text: plainText(option.content) }));

function toQuestion(block: QuestionBlock, intro: LessonBlock[]): QuizQuestion {
  const common = {
    id: block.id,
    prompt: plainText(block.content),
    points: block.props.points,
    explanation: block.props.explanation.trim(),
    intro,
  };
  switch (block.type) {
    case "singleChoiceQuestion":
      return {
        ...common,
        kind: "single_choice",
        options: options(block),
        correctOptionId: block.children.find((choice) => choice.props.correct)?.id ?? "",
      };
    case "multipleChoiceQuestion":
      return {
        ...common,
        kind: "multiple_choice",
        options: options(block),
        correctOptionIds: block.children.filter((c) => c.props.correct).map((c) => c.id),
        partialCredit: block.props.partialCredit,
      };
    case "trueFalseQuestion":
      return { ...common, kind: "true_false", answer: block.props.answer };
    case "shortAnswerQuestion":
      return {
        ...common,
        kind: "short_answer",
        acceptedAnswers: options(block).map((o) => o.text),
      };
    case "orderingQuestion":
      return { ...common, kind: "ordering", items: options(block) };
    case "matchingQuestion":
      return {
        ...common,
        kind: "matching",
        pairs: block.children.map((pair) => ({
          id: pair.id,
          left: plainText(pair.content),
          right: pair.props.match.replace(/\s+/g, " ").trim(),
        })),
      };
  }
}

const hasDuplicates = (texts: readonly string[]) =>
  new Set(texts.map((text) => text.toLocaleLowerCase())).size !== texts.length;

/** What makes a question impossible to answer or to grade; null when it is sound. */
export function questionProblem(question: QuizQuestion): string | null {
  if (question.prompt === "") return "The question has no prompt";
  switch (question.kind) {
    case "true_false":
      return null;
    case "short_answer":
      return question.acceptedAnswers.some((answer) => answer === "")
        ? "Accepted answers cannot be empty"
        : null;
    case "matching":
      return matchingProblem(question.pairs);
    case "single_choice":
    case "multiple_choice":
    case "ordering":
      return choiceProblem(question);
  }
}

function matchingProblem(pairs: readonly { left: string; right: string }[]): string | null {
  const sides = [pairs.map((p) => p.left), pairs.map((p) => p.right)];
  if (pairs.length < 2) return "A matching question needs at least 2 pairs";
  if (sides.some((side) => side.includes(""))) return "Both sides of a pair need a text";
  return sides.some(hasDuplicates) ? "Pairs must be distinct" : null;
}

function choiceProblem(
  question: Extract<QuizQuestion, { kind: "single_choice" | "multiple_choice" | "ordering" }>,
): string | null {
  const texts = (question.kind === "ordering" ? question.items : question.options).map(
    (o) => o.text,
  );
  if (texts.length < 2) return "The question needs at least 2 options";
  if (texts.includes("")) return "Options cannot be empty";
  if (hasDuplicates(texts)) return "Options must be distinct";
  if (question.kind === "single_choice" && question.correctOptionId === "") {
    return "Tick the correct option";
  }
  if (question.kind === "multiple_choice" && question.correctOptionIds.length === 0) {
    return "Tick at least one correct option";
  }
  return null;
}

function toDefinition(document: QuizDocument): Result<QuizDefinition, ContentIssue[]> {
  const questions: QuizQuestion[] = [];
  const issues: ContentIssue[] = [];
  let pending: LessonBlock[] = [];
  for (const [index, block] of document.entries()) {
    if (!isQuestionBlock(block)) {
      pending.push(block);
      continue;
    }
    if (countCorrect(block) > 1) {
      issues.push(issueAt(index, "A single choice question has exactly one correct option"));
    }
    const question = toQuestion(block, pending);
    pending = [];
    const problem = questionProblem(question);
    if (problem !== null) issues.push(issueAt(index, problem));
    questions.push(question);
  }
  if (issues.length > 0) return err(issues.slice(0, 20));
  return ok({ questions, outro: pending });
}

const countCorrect = (block: QuestionBlock) =>
  block.type === "singleChoiceQuestion" ? block.children.filter((c) => c.props.correct).length : 0;

const issueAt = (index: number, message: string): ContentIssue => ({
  code: "invalid_question",
  message,
  path: [index],
});

/**
 * Validates a quiz editor document and derives its graded definition (spec
 * 07): the document checks of a lesson, the block schemas, then the rules
 * that make every question answerable and gradable.
 */
export function editorDocumentToQuiz(input: unknown): Result<QuizDefinition, ContentIssue[]> {
  const issues = precheckDocument(input, "A quiz document");
  if (issues !== null) return err(issues);
  const blocks = parseBlocks(Array.isArray(input) ? input : []);
  if (!blocks.ok) return blocks;
  const count = blocks.value.filter(isQuestionBlock).length;
  if (count === 0) return err([{ code: "no_questions", message: "Add a question", path: [] }]);
  if (count > QUIZ_LIMITS.maxQuestions) {
    const message = `At most ${QUIZ_LIMITS.maxQuestions} questions`;
    return err([{ code: "too_many_questions", message, path: [] }]);
  }
  const definition = toDefinition(blocks.value);
  if (!definition.ok) return definition;
  const parsed = quizDefinitionSchema.safeParse(definition.value);
  return parsed.success ? ok(parsed.data) : err(schemaIssues(parsed.error));
}

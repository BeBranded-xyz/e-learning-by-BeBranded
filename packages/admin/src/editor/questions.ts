import { isQuestionType } from "./quiz-templates.js";
import type { QuestionType } from "./quiz-templates.js";

/** The shape of any BlockNote block, enough to read questions without the editor's generics. */
export type AnyBlock = {
  readonly id: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly content?: unknown;
  readonly children: readonly AnyBlock[];
};

export type QuestionOption = {
  readonly id: string;
  readonly text: string;
  readonly correct: boolean | null;
  readonly match: string | null;
};

export type QuestionSummary = {
  readonly id: string;
  readonly type: QuestionType;
  readonly prompt: string;
  readonly points: number;
  readonly explanation: string;
  readonly answer: boolean | null;
  readonly partialCredit: boolean | null;
  readonly options: readonly QuestionOption[];
};

function textOf(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  if ("text" in node && typeof node.text === "string") return node.text;
  return "content" in node && Array.isArray(node.content) ? node.content.map(textOf).join("") : "";
}

/** Plain text of a block's inline content (links included). */
export function inlineText(content: unknown): string {
  return Array.isArray(content) ? content.map(textOf).join("").trim() : "";
}

const booleanOrNull = (value: unknown) => (typeof value === "boolean" ? value : null);

function toOption(block: AnyBlock): QuestionOption {
  return {
    id: block.id,
    text: inlineText(block.content),
    correct: booleanOrNull(block.props.correct),
    match: typeof block.props.match === "string" ? block.props.match : null,
  };
}

/** The questions of a quiz editor document, in order, for the question panel. */
export function questionsOf(document: readonly AnyBlock[]): QuestionSummary[] {
  return document.flatMap((block) => {
    if (!isQuestionType(block.type)) return [];
    return [
      {
        id: block.id,
        type: block.type,
        prompt: inlineText(block.content),
        points: typeof block.props.points === "number" ? block.props.points : 1,
        explanation: typeof block.props.explanation === "string" ? block.props.explanation : "",
        answer: booleanOrNull(block.props.answer),
        partialCredit: booleanOrNull(block.props.partialCredit),
        options: block.children.map(toOption),
      },
    ];
  });
}

import { paragraph, text } from "./lesson-documents.js";

// Synthetic quiz editor documents (BlockNote JSON) for tests; no real content.

type Props = Record<string, unknown>;

function option(type: string, id: string, label: string, props: Props = {}) {
  return { id, type, props, content: [text(label)], children: [] };
}

export const choice = (id: string, label: string, correct = false) =>
  option("quizChoice", id, label, { correct });
export const accepted = (id: string, label: string) => option("quizAnswer", id, label);
const item = (id: string, label: string) => option("quizItem", id, label);
export const pair = (id: string, left: string, match: string) =>
  option("quizPair", id, left, { match });

export function questionBlock(
  type: string,
  id: string,
  options: { prompt?: string; props?: Props; children?: unknown[] } = {},
) {
  return {
    id,
    type,
    props: { points: 1, explanation: "", ...options.props },
    content: [text(options.prompt ?? `Prompt of ${id}`)],
    children: options.children ?? [],
  };
}

export const singleChoice = (id = "single") =>
  questionBlock("singleChoiceQuestion", id, {
    prompt: "Which extinguisher suits an electrical fire?",
    props: { explanation: "CO2 does not conduct electricity." },
    children: [
      choice(`${id}-a`, "Water"),
      choice(`${id}-b`, "CO2", true),
      choice(`${id}-c`, "Foam"),
    ],
  });

export const multipleChoice = (id = "multiple", partialCredit = false) =>
  questionBlock("multipleChoiceQuestion", id, {
    props: { points: 2, partialCredit },
    children: [
      choice(`${id}-a`, "Gloves", true),
      choice(`${id}-b`, "Goggles", true),
      choice(`${id}-c`, "Sandals"),
      choice(`${id}-d`, "Mask", true),
    ],
  });

export const trueFalse = (id = "truefalse", answer = true) =>
  questionBlock("trueFalseQuestion", id, { props: { answer } });

export const shortAnswer = (id = "short") =>
  questionBlock("shortAnswerQuestion", id, {
    children: [accepted(`${id}-a`, "Assembly point"), accepted(`${id}-b`, "Muster point")],
  });

export const ordering = (id = "ordering") =>
  questionBlock("orderingQuestion", id, {
    children: [
      item(`${id}-a`, "Raise the alarm"),
      item(`${id}-b`, "Evacuate"),
      item(`${id}-c`, "Gather"),
    ],
  });

export const matching = (id = "matching") =>
  questionBlock("matchingQuestion", id, {
    props: { points: 3 },
    children: [
      pair(`${id}-a`, "Red", "Fire"),
      pair(`${id}-b`, "Blue", "Mandatory"),
      pair(`${id}-c`, "Green", "Safe condition"),
    ],
  });

/** One question of every type, with context blocks before the first and after the last. */
export const fullQuizDocument: unknown[] = [
  paragraph("intro", [text("Read the safety sheet first.")]),
  singleChoice(),
  multipleChoice(),
  trueFalse(),
  shortAnswer(),
  ordering(),
  paragraph("context", [text("Look at the signs below.")]),
  matching(),
  paragraph("outro", [text("Well done.")]),
];

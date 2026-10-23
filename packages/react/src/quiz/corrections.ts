import type {
  ApiQuizCorrection,
  SurveyChoice,
  SurveyElement,
  SurveyJson,
} from "@bebranded/elearning-core";

export type CorrectionView = {
  readonly name: string;
  readonly title: string;
  readonly correct: boolean;
  /** The right answer in words, from the option texts the learner saw. */
  readonly answer: string;
  readonly explanation: string;
};

const isList = (answer: unknown): answer is readonly string[] => Array.isArray(answer);

type Labels = { readonly yes: string; readonly no: string };
type Element = SurveyElement | undefined;

function optionsOf(element: Element, side: "choices" | "columns"): readonly SurveyChoice[] {
  if (element === undefined) return [];
  if (side === "columns") return element.type === "matrix" ? element.columns : [];
  return "choices" in element ? element.choices : [];
}

const textOf = (element: Element, value: string, side: "choices" | "columns" = "choices") =>
  optionsOf(element, side).find((option) => option.value === value)?.text ?? value;

function answerText(element: Element, answer: ApiQuizCorrection["correct_answer"], labels: Labels) {
  if (typeof answer === "boolean") return answer ? labels.yes : labels.no;
  if (typeof answer === "string")
    return element?.type === "text" ? answer : textOf(element, answer);
  if (isList(answer)) return answer.map((value) => textOf(element, value)).join(", ");
  const rows = element?.type === "matrix" ? element.rows : [];
  return rows
    .map((row) => `${row.text} → ${textOf(element, answer[row.value] ?? "", "columns")}`)
    .join(", ");
}

/** Corrections in words, matched to the questions of the attempt's survey. */
export function correctionViews(
  survey: SurveyJson,
  corrections: readonly ApiQuizCorrection[],
  labels: Labels,
): CorrectionView[] {
  const elements = survey.pages[0].elements;
  return corrections.map((correction) => {
    const element = elements.find((candidate) => candidate.name === correction.name);
    return {
      name: correction.name,
      title: element !== undefined && "title" in element ? element.title : correction.name,
      correct: correction.correct,
      answer: answerText(element, correction.correct_answer, labels),
      explanation: correction.explanation,
    };
  });
}

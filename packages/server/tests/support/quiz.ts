// Synthetic quiz editor documents (BlockNote JSON) for API tests; no real content.

const text = (value: string) => [{ type: "text", text: value, styles: {} }];
const option = (type: string, id: string, label: string, props: Record<string, unknown> = {}) => ({
  id,
  type,
  props,
  content: text(label),
  children: [],
});

/**
 * Two questions worth 1 point each: a true or false (answer: true) and a
 * single choice (answer: "Green"), with a context paragraph between them.
 */
export function quizDocument(prompt = "Exit signs are green.") {
  return [
    {
      id: "tf",
      type: "trueFalseQuestion",
      props: { points: 1, explanation: "Safe conditions are signalled in green.", answer: true },
      content: text(prompt),
      children: [],
    },
    {
      id: "context",
      type: "paragraph",
      props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
      content: text("Look at the poster in the hall."),
      children: [],
    },
    {
      id: "color",
      type: "singleChoiceQuestion",
      props: { points: 1, explanation: "Green means safe." },
      content: text("Which color marks an emergency exit?"),
      children: [
        option("quizChoice", "color-red", "Red", { correct: false }),
        option("quizChoice", "color-green", "Green", { correct: true }),
        option("quizChoice", "color-blue", "Blue", { correct: false }),
      ],
    },
  ];
}

type SurveyElement = {
  type: string;
  name: string;
  choices?: { value: string; text: string }[];
};
export type Survey = { pages: [{ elements: SurveyElement[] }] };

/** The right answers for an attempt's survey, found from the option texts the learner sees. */
export function rightAnswers(survey: Survey): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const element of survey.pages[0].elements) {
    if (element.type === "boolean") answers[element.name] = true;
    if (element.type === "radiogroup") {
      answers[element.name] = element.choices?.find((choice) => choice.text === "Green")?.value;
    }
  }
  return answers;
}

export function wrongAnswers(survey: Survey): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const element of survey.pages[0].elements) {
    if (element.type === "boolean") answers[element.name] = false;
    if (element.type === "radiogroup") {
      answers[element.name] = element.choices?.find((choice) => choice.text === "Red")?.value;
    }
  }
  return answers;
}

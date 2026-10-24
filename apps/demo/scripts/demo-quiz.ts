import { createHash, randomUUID } from "node:crypto";

import { editorDocumentToQuiz, quizIdSchema } from "@bebranded/elearning-core";
import type { JsonValue, LessonDetail, Quiz } from "@bebranded/elearning-core";

// A synthetic quiz for the demo (BlockNote JSON of the quiz editor); no real content.

const text = (value: string) => [{ type: "text", text: value, styles: {} }];
const choice = (id: string, label: string, correct = false) => ({
  id,
  type: "quizChoice",
  props: { correct },
  content: text(label),
  children: [],
});

const fireQuizDocument: JsonValue = [
  {
    id: "context",
    type: "paragraph",
    props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
    content: text("Three questions on the fire procedures lesson."),
    children: [],
  },
  {
    id: "first",
    type: "singleChoiceQuestion",
    props: { points: 1, explanation: "Everyone else can only react once they know." },
    content: text("What do you do first when you discover a fire?"),
    children: [
      choice("first-alarm", "Raise the alarm", true),
      choice("first-belongings", "Collect your belongings"),
      choice("first-windows", "Open the windows"),
    ],
  },
  {
    id: "lifts",
    type: "trueFalseQuestion",
    props: { points: 1, explanation: "Lifts can stop between floors.", answer: false },
    content: text("Lifts are safe to use during a fire."),
    children: [],
  },
  {
    id: "exits",
    type: "multipleChoiceQuestion",
    props: { points: 2, explanation: "Exits must stay clear and visible.", partialCredit: false },
    content: text("Which of these keep an evacuation route usable?"),
    children: [
      choice("exits-clear", "Clear corridors", true),
      choice("exits-signs", "Lit exit signs", true),
      choice("exits-locked", "Locked fire doors"),
    ],
  },
];

/** The quiz as the admin API would store it: validated, with the definition's SHA-256. */
export function demoQuiz(lesson: LessonDetail): Quiz {
  const result = editorDocumentToQuiz(fireQuizDocument);
  if (!result.ok) throw new Error(`Invalid demo quiz: ${JSON.stringify(result.error)}`);
  return {
    id: quizIdSchema.parse(randomUUID()),
    lessonId: lesson.id,
    editorDocument: fireQuizDocument,
    definition: result.value,
    version: createHash("sha256").update(JSON.stringify(result.value)).digest("hex"),
  };
}

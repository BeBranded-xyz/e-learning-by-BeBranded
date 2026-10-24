"use client";

import { CheckboxField, TextField } from "../components/Fields.js";
import type { QuestionOption, QuestionSummary } from "../editor/questions.js";
import { useAdmin } from "../provider/admin-context.js";

export type QuestionPanelProps = {
  readonly questions: readonly QuestionSummary[];
  /** Merges props into a block of the editor (a question or one of its options). */
  readonly onChange: (
    blockId: string,
    props: Readonly<Record<string, string | number | boolean>>,
  ) => void;
};

function OptionFields({
  question,
  option,
  onChange,
}: {
  question: QuestionSummary;
  option: QuestionOption;
  onChange: QuestionPanelProps["onChange"];
}) {
  const { t } = useAdmin();
  if (question.type === "matchingQuestion") {
    return (
      <TextField
        label={`${option.text} →`}
        maxLength={500}
        value={option.match ?? ""}
        onChange={(match) => {
          onChange(option.id, { match });
        }}
      />
    );
  }
  if (option.correct === null) return null;
  return (
    <CheckboxField
      label={t.t("quiz.correct", { option: option.text })}
      checked={option.correct}
      onChange={(correct) => {
        onChange(option.id, { correct });
      }}
    />
  );
}

type FieldsProps = { question: QuestionSummary; onChange: QuestionPanelProps["onChange"] };

function ScoringFields({ question, onChange }: FieldsProps) {
  const { t } = useAdmin();
  return (
    <>
      <TextField
        label={t.t("quiz.points")}
        type="number"
        min={0}
        max={100}
        value={String(question.points)}
        onChange={(value) => {
          onChange(question.id, { points: Number(value) });
        }}
      />
      <TextField
        label={t.t("quiz.explanation")}
        multiline
        maxLength={2000}
        value={question.explanation}
        onChange={(explanation) => {
          onChange(question.id, { explanation });
        }}
      />
    </>
  );
}

function AnswerFields({ question, onChange }: FieldsProps) {
  const { t } = useAdmin();
  return (
    <>
      {question.answer === null ? null : (
        <CheckboxField
          label={`${t.t("quiz.answer")}: ${question.answer ? t.t("quiz.true") : t.t("quiz.false")}`}
          checked={question.answer}
          onChange={(answer) => {
            onChange(question.id, { answer });
          }}
        />
      )}
      {question.partialCredit === null ? null : (
        <CheckboxField
          label={t.t("quiz.partialCredit")}
          checked={question.partialCredit}
          onChange={(partialCredit) => {
            onChange(question.id, { partialCredit });
          }}
        />
      )}
      {question.options.map((option) => (
        <OptionFields key={option.id} question={question} option={option} onChange={onChange} />
      ))}
    </>
  );
}

function QuestionFields({ question, number, onChange }: FieldsProps & { number: number }) {
  const { t } = useAdmin();
  return (
    <fieldset className="el-admin-question">
      <legend>{t.t("quiz.question", { number, prompt: question.prompt })}</legend>
      <ScoringFields question={question} onChange={onChange} />
      <AnswerFields question={question} onChange={onChange} />
    </fieldset>
  );
}

/** Points, explanations and correct answers: question props BlockNote has no field for (B-046). */
export function QuestionPanel({ questions, onChange }: QuestionPanelProps) {
  const { t } = useAdmin();
  return (
    <aside className="el-admin-questions" aria-label={t.t("quiz.settings")}>
      {questions.length === 0 ? <p className="el-meta">{t.t("quiz.empty")}</p> : null}
      {questions.map((question, index) => (
        <QuestionFields
          key={question.id}
          question={question}
          number={index + 1}
          onChange={onChange}
        />
      ))}
    </aside>
  );
}

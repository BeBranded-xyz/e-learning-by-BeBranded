"use client";

import { useEffect, useState } from "react";

import type { ApiQuizAttempt } from "@bebranded/elearning-core";
import type { SurveyModel } from "survey-core";

import { useElearning } from "../provider/context.js";
import type { SurveyRuntime } from "../quiz/survey-runtime.js";
import { formatSeconds, useCountdown } from "../quiz/useCountdown.js";
import { useSurveyRuntime } from "../quiz/useSurveyRuntime.js";

export type QuizFormProps = {
  readonly attempt: ApiQuizAttempt;
  /** Called once with the raw SurveyJS answers. */
  readonly onSubmit: (answers: Record<string, unknown>) => void;
};

type Labels = { submit: string; yes: string; no: string };

/** One SurveyJS model per attempt, labelled in the module's language. */
function useSurveyModel(
  runtime: SurveyRuntime,
  attempt: ApiQuizAttempt,
  labels: Labels,
  locale: string,
) {
  const [model] = useState(() => {
    const created = new runtime.Model(attempt.survey);
    created.locale = locale.split("-")[0] ?? "en";
    created.showCompletePage = false;
    created.showQuestionNumbers = "on";
    created.completeText = labels.submit;
    // True or false as two labelled radio buttons, not a three-state switch.
    for (const question of created.getAllQuestions()) {
      if (question instanceof runtime.QuestionBoolean) {
        question.displayMode = "radio";
        question.labelTrue = labels.yes;
        question.labelFalse = labels.no;
      }
    }
    return created;
  });
  return model;
}

function SurveyForm({ runtime, attempt, onSubmit }: QuizFormProps & { runtime: SurveyRuntime }) {
  const { i18n } = useElearning();
  const labels = {
    submit: i18n.t("quiz.submit"),
    yes: i18n.t("quiz.true"),
    no: i18n.t("quiz.false"),
  };
  const model = useSurveyModel(runtime, attempt, labels, i18n.locale);
  useEffect(() => {
    const complete = (sender: SurveyModel) => {
      // SurveyJS data is a plain object of the answers, keyed by question name.
      onSubmit(sender.data as Record<string, unknown>);
    };
    model.onComplete.add(complete);
    return () => {
      model.onComplete.remove(complete);
    };
  }, [model, onSubmit]);
  const left = useCountdown(attempt.expires_at, () => {
    // Time is up: send what was answered; the server allows a short grace period.
    if (model.state === "running") model.doComplete();
  });
  const { Survey } = runtime;
  return (
    <div className="el-quiz-form">
      {left === null ? null : (
        <p className="el-quiz-timer" role="timer" aria-live="off">
          {i18n.t("quiz.timeLeft", { time: formatSeconds(left) })}
        </p>
      )}
      <Survey model={model} />
    </div>
  );
}

/** One quiz attempt, rendered by SurveyJS once it has loaded. */
export function QuizForm(props: QuizFormProps) {
  const { i18n } = useElearning();
  const state = useSurveyRuntime(true, i18n.locale);
  if (state.kind === "failed") {
    return (
      <p className="el-state el-state-error" role="alert">
        {i18n.t("quiz.loadFailed")}
      </p>
    );
  }
  if (state.kind === "loading") {
    return (
      <p className="el-state" role="status" aria-live="polite">
        {i18n.t("quiz.loading")}
      </p>
    );
  }
  return <SurveyForm runtime={state.runtime} {...props} />;
}

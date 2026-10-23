"use client";

import { useState } from "react";

import type {
  ApiLesson,
  ApiLessonQuiz,
  ApiQuizAttempt,
  ApiQuizResult,
} from "@bebranded/elearning-core";

import { ElearningApiError } from "../api/api-error.js";
import { useOpenQuizAttempt, useSubmitQuizAttempt } from "../hooks/queries.js";
import type { I18n } from "../i18n/translator.js";
import { useElearning } from "../provider/context.js";
import { QuizForm } from "./QuizForm.js";
import { QuizIntro } from "./QuizIntro.js";
import { QuizResult } from "./QuizResult.js";

export type QuizProps = {
  readonly lesson: ApiLesson;
  readonly quiz: ApiLessonQuiz;
};

type Phase =
  | { readonly kind: "intro" }
  | { readonly kind: "taking"; readonly attempt: ApiQuizAttempt }
  | { readonly kind: "result"; readonly attempt: ApiQuizAttempt; readonly result: ApiQuizResult };

/** A failed open or submit, in words. Unknown failures get the generic message. */
function noticeFor(error: unknown, i18n: I18n): string {
  if (!(error instanceof ElearningApiError)) return i18n.t("state.error");
  switch (error.code) {
    case "attempts_exhausted":
      return i18n.t("quiz.exhausted");
    case "cooldown":
      return typeof error.details.next_attempt_at === "string"
        ? i18n.t("quiz.cooldown", { date: i18n.formatDateTime(error.details.next_attempt_at) })
        : i18n.t("state.error");
    case "quiz_changed":
      return i18n.t("quiz.changed");
    case "quiz_not_ready":
      return i18n.t("quiz.notReady");
    default:
      return i18n.t("state.error");
  }
}

/**
 * A quiz lesson (spec 07): its rules, then an attempt rendered by SurveyJS,
 * then the score graded by the server. The browser never sees the answers
 * before the server decides to show corrections.
 */
export function Quiz({ lesson, quiz }: QuizProps) {
  const { i18n } = useElearning();
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [notice, setNotice] = useState<string | null>(null);
  const open = useOpenQuizAttempt(lesson.id);
  const submit = useSubmitQuizAttempt(lesson.id);
  const fail = (error: unknown) => {
    setNotice(noticeFor(error, i18n));
    setPhase({ kind: "intro" });
  };
  const start = () => {
    setNotice(null);
    open.mutate(undefined, {
      onSuccess: (attempt) => {
        setPhase({ kind: "taking", attempt });
      },
      onError: fail,
    });
  };
  if (!quiz.ready) return <p className="el-quiz-notice">{i18n.t("quiz.notReady")}</p>;
  if (phase.kind === "taking") {
    const { attempt } = phase;
    const send = (answers: Record<string, unknown>) => {
      submit.mutate(
        { attemptId: attempt.id, answers },
        {
          onSuccess: (result) => {
            setPhase({ kind: "result", attempt, result });
          },
          onError: fail,
        },
      );
    };
    return <QuizForm attempt={attempt} onSubmit={send} />;
  }
  if (phase.kind === "result") {
    const canRetry = phase.result.attempts_remaining !== 0 && phase.result.next_attempt_at === null;
    return (
      <QuizResult attempt={phase.attempt} result={phase.result} onRetry={canRetry ? start : null} />
    );
  }
  return <QuizIntro quiz={quiz} onStart={start} starting={open.isPending} notice={notice} />;
}

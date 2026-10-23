"use client";

import { useEffect } from "react";

import { LessonView } from "../components/LessonView.js";
import { QueryState } from "../components/QueryState.js";
import { useCompleteLesson, useLesson, useStartLesson } from "../hooks/queries.js";

export type LessonPlayerProps = { readonly lessonId: string };

/**
 * Shows a lesson and records that the learner opened it. Opening is an event
 * the server records (POST /start, idempotent), not a data fetch: the effect
 * only reports it, once per lesson.
 */
export function LessonPlayer({ lessonId }: LessonPlayerProps) {
  const lesson = useLesson(lessonId);
  const { mutate: start } = useStartLesson();
  const complete = useCompleteLesson();
  const opened = lesson.isSuccess;

  useEffect(() => {
    if (opened) start(lessonId);
  }, [opened, lessonId, start]);

  if (lesson.isPending) return <QueryState kind="loading" />;
  if (lesson.isError)
    return <QueryState kind="error" error={lesson.error} onRetry={() => void lesson.refetch()} />;
  return (
    <LessonView
      lesson={lesson.data}
      onMarkDone={() => {
        complete.mutate(lessonId);
      }}
      marking={complete.isPending}
    />
  );
}

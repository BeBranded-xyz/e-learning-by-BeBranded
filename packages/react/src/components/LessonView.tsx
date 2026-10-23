"use client";

import type { ApiLesson } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { LessonContent } from "./LessonContent.js";
import { VideoPlayer } from "./VideoPlayer.js";

export type LessonViewProps = {
  readonly lesson: ApiLesson;
  readonly onMarkDone?: () => void;
  readonly marking?: boolean;
};

/** A lesson with its body and, for text lessons, the "Mark as done" action. */
export function LessonView({ lesson, onMarkDone, marking = false }: LessonViewProps) {
  const { i18n } = useElearning();
  const done = lesson.status === "completed";
  return (
    <article className="el-lesson">
      <h1>{lesson.title}</h1>
      {lesson.estimated_minutes === null ? null : (
        <p className="el-meta">{i18n.t("lesson.minutes", { minutes: lesson.estimated_minutes })}</p>
      )}
      {lesson.video === null ? null : <VideoPlayer lesson={lesson} video={lesson.video} />}
      <LessonContent html={lesson.html} />
      <footer className="el-lesson-footer">
        <p role="status" aria-live="polite" className="el-meta">
          {done ? i18n.t("lesson.done") : null}
        </p>
        {lesson.type === "text" && !done && onMarkDone !== undefined ? (
          <button
            type="button"
            className="el-button el-button-primary"
            onClick={onMarkDone}
            disabled={marking}
          >
            {i18n.t("lesson.markDone")}
          </button>
        ) : null}
        {lesson.type === "text" ? null : <p className="el-meta">{i18n.t("lesson.notManual")}</p>}
      </footer>
    </article>
  );
}

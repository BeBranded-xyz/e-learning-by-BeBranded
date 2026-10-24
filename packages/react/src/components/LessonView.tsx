"use client";

import type { ApiLesson } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { useUi } from "../ui/kit.js";
import { ExportActions } from "./ExportActions.js";
import { LessonContent } from "./LessonContent.js";
import { Quiz } from "./Quiz.js";
import { VideoPlayer } from "./VideoPlayer.js";

export type LessonViewProps = {
  readonly lesson: ApiLesson;
  readonly onMarkDone?: () => void;
  readonly marking?: boolean;
};

/** A lesson with its body and, for text lessons, the "Mark as done" action. */
export function LessonView({ lesson, onMarkDone, marking = false }: LessonViewProps) {
  const { i18n } = useElearning();
  const { Button } = useUi();
  const done = lesson.status === "completed";
  return (
    <article className="el-lesson">
      <h1>{lesson.title}</h1>
      {lesson.estimated_minutes === null ? null : (
        <p className="el-meta">{i18n.t("lesson.minutes", { minutes: lesson.estimated_minutes })}</p>
      )}
      <ExportActions kind="lesson" id={lesson.id} formats={lesson.export_formats} />
      {lesson.video === null ? null : <VideoPlayer lesson={lesson} video={lesson.video} />}
      <LessonContent html={lesson.html} />
      {lesson.quiz === null ? null : <Quiz lesson={lesson} quiz={lesson.quiz} />}
      <footer className="el-lesson-footer">
        <p role="status" aria-live="polite" className="el-meta">
          {done ? i18n.t("lesson.done") : null}
        </p>
        {lesson.type === "text" && !done && onMarkDone !== undefined ? (
          <Button variant="primary" onClick={onMarkDone} disabled={marking}>
            {i18n.t("lesson.markDone")}
          </Button>
        ) : null}
        {lesson.type === "text" ? null : <p className="el-meta">{i18n.t("lesson.notManual")}</p>}
      </footer>
    </article>
  );
}

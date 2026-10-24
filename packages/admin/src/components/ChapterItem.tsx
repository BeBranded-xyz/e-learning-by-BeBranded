"use client";

import type { ApiAdminLessonSummary, ApiCourseTree } from "@bebranded/elearning-core";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { AddLessonForm } from "./AddLessonForm.js";
import { DeleteButton } from "./DeleteButton.js";
import { DropZone } from "./DropZone.js";
import { MoveButtons } from "./Fields.js";
import { LessonItem } from "./LessonItem.js";
import { useUi } from "@bebranded/elearning-react";
import { statusTone } from "./status-tone.js";

type Chapter = ApiCourseTree["chapters"][number];

export type ChapterItemProps = {
  readonly chapter: Chapter;
  readonly courseId: string;
  readonly editable: boolean;
  readonly busy: boolean;
  readonly lessonHref: (lesson: ApiAdminLessonSummary) => string;
  readonly onMoveChapter: (delta: -1 | 1) => void;
  readonly onMoveLesson: (lessonId: string, delta: -1 | 1) => void;
  readonly onDragLesson: (lessonId: string) => void;
  /** Drops the dragged lesson at `index` of this chapter. */
  readonly onDrop: (index: number) => void;
};

function ChapterActions({ chapter, courseId, busy, onMoveChapter }: ChapterItemProps) {
  const { Button } = useUi();
  const { t } = useAdmin();
  const update = useCourseMutation(courseId, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.updateChapter(chapter.id, body),
  );
  const remove = useCourseMutation(courseId, (admin) => admin.deleteChapter(chapter.id));
  const published = chapter.status === "published";
  return (
    <span className="el-admin-actions">
      <MoveButtons
        disabled={busy}
        onMove={onMoveChapter}
        labels={{
          up: t.t("action.moveUp", { title: chapter.title }),
          down: t.t("action.moveDown", { title: chapter.title }),
        }}
      />
      <Button
        disabled={update.isPending}
        onClick={() => {
          update.mutate({ status: published ? "draft" : "published" });
        }}
      >
        {published ? t.t("action.unpublish") : t.t("action.publish")}
      </Button>
      <DeleteButton
        title={chapter.title}
        onConfirm={() => {
          remove.mutate(undefined);
        }}
      />
    </span>
  );
}

function ChapterLessons(props: ChapterItemProps) {
  const { t } = useAdmin();
  const { chapter, editable, busy } = props;
  return (
    <DropZone
      enabled={editable && !busy}
      onDrop={() => {
        props.onDrop(chapter.lessons.length);
      }}
    >
      {chapter.lessons.length === 0 ? <p className="el-meta">{t.t("tree.chapterEmpty")}</p> : null}
      <ul className="el-admin-lessons">
        {chapter.lessons.map((lesson, index) => (
          <LessonItem
            key={lesson.id}
            lesson={lesson}
            href={props.lessonHref(lesson)}
            editable={editable}
            busy={busy}
            onMove={(delta) => {
              props.onMoveLesson(lesson.id, delta);
            }}
            onDragStart={() => {
              props.onDragLesson(lesson.id);
            }}
            onDropBefore={() => {
              props.onDrop(index);
            }}
          />
        ))}
      </ul>
    </DropZone>
  );
}

export function ChapterItem(props: ChapterItemProps) {
  const { Badge } = useUi();
  const { t } = useAdmin();
  const { chapter, editable } = props;
  return (
    <li className="el-admin-chapter" aria-labelledby={`chapter-${chapter.id}`}>
      <div className="el-admin-chapter-header">
        <h4 id={`chapter-${chapter.id}`}>{chapter.title}</h4>
        <Badge tone={statusTone(chapter.status)} data-status={chapter.status}>
          {t.t(`status.${chapter.status}`)}
        </Badge>
        {editable ? <ChapterActions {...props} /> : null}
      </div>
      <ChapterLessons {...props} />
      {editable ? (
        <AddLessonForm
          courseId={props.courseId}
          chapterId={chapter.id}
          position={chapter.lessons.length}
        />
      ) : null}
    </li>
  );
}

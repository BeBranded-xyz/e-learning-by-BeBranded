"use client";

import type { ApiAdminLessonSummary, ApiCourseTree } from "@bebranded/elearning-core";
import { useId, useRef, useState } from "react";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { moveChapter, moveLessonBy, moveLessonTo, orderOf, reorderBody } from "../tree/reorder.js";
import type { TreeOrder } from "../tree/reorder.js";
import { AddChapterForm } from "./AddChapterForm.js";
import { ChapterItem } from "./ChapterItem.js";
import { ErrorAlert } from "./ErrorAlert.js";

export type ContentTreeProps = {
  readonly course: ApiCourseTree;
  readonly lessonHref: (lesson: ApiAdminLessonSummary) => string;
};

function titleOf(course: ApiCourseTree, itemId: string): string {
  const lessons = course.chapters.flatMap((chapter) => chapter.lessons);
  return [...course.chapters, ...lessons].find((item) => item.id === itemId)?.title ?? "";
}

/** Reorders through one mutation, from the buttons or a drop, and announces the move. */
function useTreeMoves(course: ApiCourseTree) {
  const { t } = useAdmin();
  const dragged = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const reorder = useCourseMutation(course.id, (admin, order: TreeOrder) =>
    admin.reorder(reorderBody(course.id, order)),
  );
  const order = orderOf(course);
  const save = (next: TreeOrder, itemId: string) => {
    if (JSON.stringify(next) === JSON.stringify(order)) return;
    const moved = t.t("tree.moved", { title: titleOf(course, itemId) });
    reorder.mutate(next, {
      onSuccess: () => {
        setAnnouncement(moved);
      },
    });
  };
  return {
    reorder,
    announcement,
    moveChapter: (chapterId: string, delta: -1 | 1) => {
      save(moveChapter(order, chapterId, delta), chapterId);
    },
    moveLesson: (lessonId: string, delta: -1 | 1) => {
      save(moveLessonBy(order, lessonId, delta), lessonId);
    },
    drag: (lessonId: string) => {
      dragged.current = lessonId;
    },
    drop: (chapterId: string, index: number) => {
      const lessonId = dragged.current;
      dragged.current = null;
      if (lessonId !== null) save(moveLessonTo(order, lessonId, { chapterId, index }), lessonId);
    },
  };
}

/**
 * The chapters and lessons of a course: reordered by drag and drop or with
 * the move buttons, both saved as one reorder. The server refuses a stale
 * tree (409 `tree_out_of_date`); the tree is reloaded after every write.
 */
export function ContentTree({ course, lessonHref }: ContentTreeProps) {
  const { t } = useAdmin();
  const id = useId();
  const moves = useTreeMoves(course);
  return (
    <section className="el-admin-tree" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{t.t("tree.title")}</h3>
      {course.editable ? <p className="el-meta">{t.t("tree.dragHint")}</p> : null}
      {course.chapters.length === 0 ? <p className="el-meta">{t.t("tree.empty")}</p> : null}
      <ol className="el-admin-chapters">
        {course.chapters.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            courseId={course.id}
            editable={course.editable}
            busy={moves.reorder.isPending}
            lessonHref={lessonHref}
            onMoveChapter={(delta) => {
              moves.moveChapter(chapter.id, delta);
            }}
            onMoveLesson={moves.moveLesson}
            onDragLesson={moves.drag}
            onDrop={(index) => {
              moves.drop(chapter.id, index);
            }}
          />
        ))}
      </ol>
      <p className="el-visually-hidden" role="status" aria-live="polite">
        {moves.announcement}
      </p>
      <ErrorAlert error={moves.reorder.error} />
      {course.editable ? (
        <AddChapterForm courseId={course.id} position={course.chapters.length} />
      ) : null}
    </section>
  );
}

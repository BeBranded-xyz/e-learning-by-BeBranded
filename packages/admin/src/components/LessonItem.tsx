"use client";

import type { ApiAdminLessonSummary } from "@bebranded/elearning-core";

import { useAdmin } from "../provider/admin-context.js";
import { MoveButtons } from "./Fields.js";
import { DropZone } from "./DropZone.js";

export type LessonItemProps = {
  readonly lesson: ApiAdminLessonSummary;
  readonly href: string;
  readonly editable: boolean;
  readonly busy: boolean;
  readonly onMove: (delta: -1 | 1) => void;
  readonly onDragStart: () => void;
  /** A lesson dropped on this one goes before it. */
  readonly onDropBefore: () => void;
};

export function LessonItem({ lesson, href, editable, busy, ...actions }: LessonItemProps) {
  const { t } = useAdmin();
  return (
    <li className="el-admin-lesson">
      <DropZone
        enabled={editable && !busy}
        draggable
        onDragStart={actions.onDragStart}
        onDrop={actions.onDropBefore}
      >
        <a href={href}>{lesson.title}</a>
        <span className="el-tag">{t.t(`type.${lesson.type}`)}</span>
        <span className="el-tag" data-status={lesson.status}>
          {t.t(`status.${lesson.status}`)}
        </span>
        {editable ? (
          <MoveButtons
            disabled={busy}
            onMove={actions.onMove}
            labels={{
              up: t.t("action.moveUp", { title: lesson.title }),
              down: t.t("action.moveDown", { title: lesson.title }),
            }}
          />
        ) : null}
      </DropZone>
    </li>
  );
}

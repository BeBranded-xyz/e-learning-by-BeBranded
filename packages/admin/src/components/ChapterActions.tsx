"use client";

import { useRef, useState } from "react";
import { useDisclosureDismiss } from "../hooks/use-disclosure-dismiss.js";
import { useUi } from "@bebranded/elearning-react";
import type { ChapterItemProps } from "./ChapterItem.js";
import { useAdmin } from "../provider/admin-context.js";
import { useCourseMutation } from "../hooks/admin-queries.js";
import { ChapterSettings } from "./ChapterSettings.js";
import { DeleteButton } from "./DeleteButton.js";
import { MoveButtons } from "./Fields.js";
import { ErrorAlert } from "./ErrorAlert.js";

type Props = Pick<ChapterItemProps, "chapter" | "courseId" | "busy" | "onMoveChapter">;
function ChapterControls({
  chapter,
  courseId,
  busy,
  onMoveChapter,
  onDone,
}: Props & { onDone: () => void }) {
  const { Button } = useUi();
  const { t } = useAdmin();
  const update = useCourseMutation(courseId, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.updateChapter(chapter.id, body),
  );
  const remove = useCourseMutation(courseId, (admin) => admin.deleteChapter(chapter.id));
  const published = chapter.status === "published";
  return (
    <>
      <div className="el-admin-actions">
        <MoveButtons
          disabled={busy}
          onMove={(delta) => {
            onMoveChapter(delta);
            onDone();
          }}
          labels={{
            up: t.t("action.moveUp", { title: chapter.title }),
            down: t.t("action.moveDown", { title: chapter.title }),
          }}
        />
      </div>
      <Button
        disabled={update.isPending}
        onClick={() => {
          update.mutate({ status: published ? "draft" : "published" }, { onSuccess: onDone });
        }}
      >
        {published ? t.t("action.unpublish") : t.t("action.publish")}
      </Button>
      <DeleteButton
        title={chapter.title}
        disabled={remove.isPending}
        onConfirm={() => {
          remove.mutate(undefined);
        }}
      />
      <ErrorAlert error={update.error ?? remove.error} />
    </>
  );
}

/** A named disclosure keeps secondary controls out of the chapter's primary reading order. */
export function ChapterActions(props: Props) {
  const { t } = useAdmin();
  const label = t.t("chapter.actions", { title: props.chapter.title });
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useDisclosureDismiss(ref, open);
  const close = () => {
    if (ref.current === null) return;
    ref.current.open = false;
    ref.current.querySelector("summary")?.focus();
  };
  return (
    <details
      className="el-chapter-actions"
      ref={ref}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary aria-label={label} title={label}>
        <span aria-hidden="true">•••</span>
      </summary>
      <div className="el-chapter-action-panel">
        <details className="el-author-rename">
          <summary>{t.t("action.edit")}</summary>
          <ChapterSettings
            key={props.chapter.id}
            courseId={props.courseId}
            chapter={props.chapter}
          />
        </details>
        <ChapterControls {...props} onDone={close} />
      </div>
    </details>
  );
}

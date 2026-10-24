"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LessonPreviewContent, QueryState, useUi } from "@bebranded/elearning-react";

import { adminKeys } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";

type ToolbarProps = {
  width: "desktop" | "mobile";
  onWidth: (value: "desktop" | "mobile") => void;
  pending: boolean;
  onRefresh: () => void;
};
function PreviewToolbar({ width, onWidth, pending, onRefresh }: ToolbarProps) {
  const { Button } = useUi();
  const { t } = useAdmin();
  return (
    <div className="el-author-toolbar">
      <p className="el-meta">{t.t("preview.saved")}</p>
      <div className="el-admin-actions">
        <Button
          aria-pressed={width === "desktop"}
          onClick={() => {
            onWidth("desktop");
          }}
        >
          {t.t("preview.desktop")}
        </Button>
        <Button
          aria-pressed={width === "mobile"}
          onClick={() => {
            onWidth("mobile");
          }}
        >
          {t.t("preview.mobile")}
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            onRefresh();
          }}
        >
          {t.t("preview.refresh")}
        </Button>
      </div>
    </div>
  );
}

/** Saved-content preview; refreshing never starts a learner session. */
export function LessonPreview({ lessonId }: { readonly lessonId: string }) {
  const { admin, t } = useAdmin();
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const preview = useQuery({
    queryKey: [...adminKeys.lesson(lessonId), "preview"],
    queryFn: () => admin.previewLesson(lessonId),
  });
  return (
    <section className="el-author-preview" aria-label={t.t("workspace.preview")}>
      <PreviewToolbar
        width={width}
        onWidth={setWidth}
        pending={preview.isFetching}
        onRefresh={() => {
          void preview.refetch();
        }}
      />
      {preview.isPending ? (
        <QueryState kind="loading" />
      ) : preview.isError ? (
        <QueryState
          kind="error"
          error={preview.error}
          onRetry={() => {
            void preview.refetch();
          }}
        />
      ) : (
        <article className="el-author-preview-frame" data-width={width}>
          <h3>{preview.data.title}</h3>
          <LessonPreviewContent preview={preview.data} />
        </article>
      )}
    </section>
  );
}

"use client";

import type { ApiAdminLesson } from "@bebranded/elearning-core";
import { ElearningApiError } from "@bebranded/elearning-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { ErrorAlert } from "../components/ErrorAlert.js";
import { adminKeys } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { uploadVideo } from "../uploads/video-upload.js";

function VideoStatus({ video }: { readonly video: ApiAdminLesson["video"] }) {
  const { t } = useAdmin();
  if (video === null) return <p className="el-meta">{t.t("video.status.none")}</p>;
  const minutes = Math.max(1, Math.round((video.duration_seconds ?? 0) / 60));
  return (
    <>
      <p className="el-meta" data-status={video.status}>
        {video.status === "ready"
          ? t.t("video.status.ready", { minutes })
          : t.t(`video.status.${video.status}`)}
      </p>
      {video.status === "ready" && video.captions.length === 0 ? (
        <p className="el-admin-warning" role="note">
          {t.t("video.noCaptions")}
        </p>
      ) : null}
    </>
  );
}

/**
 * The video of a video lesson: status, the captions warning of spec 06, and
 * an upload straight to the provider (tus for files over 200 MB).
 */
export function VideoLessonEditor({ lesson }: { readonly lesson: ApiAdminLesson }) {
  const { admin, upload, t } = useAdmin();
  const id = useId();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const send = useMutation({
    mutationFn: (file: File) =>
      uploadVideo(file, { admin, upload, lessonId: lesson.id, onProgress: setProgress }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.lesson(lesson.id) }),
  });
  return (
    <section className="el-admin-video" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t.t("video.title")}</h3>
      <VideoStatus video={lesson.video} />
      <label htmlFor={`${id}-file`}>{t.t("video.choose")}</label>
      <input
        id={`${id}-file`}
        type="file"
        accept="video/*"
        disabled={send.isPending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) send.mutate(file);
        }}
      />
      {send.isPending ? (
        <p role="status">
          <progress
            max={1}
            value={progress}
            aria-label={t.t("video.uploading", { percent: t.formatPercent(progress) })}
          />{" "}
          {t.t("video.uploading", { percent: t.formatPercent(progress) })}
        </p>
      ) : null}
      {send.isSuccess ? <p role="status">{t.t("video.uploaded")}</p> : null}
      {send.error instanceof ElearningApiError ? <ErrorAlert error={send.error} /> : null}
      {send.isError && !(send.error instanceof ElearningApiError) ? (
        <p className="el-admin-error" role="alert">
          {t.t("video.uploadFailed")}
        </p>
      ) : null}
    </section>
  );
}

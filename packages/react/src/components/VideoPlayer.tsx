"use client";

import { useRef, useState } from "react";

import type { ApiLesson, ApiLessonVideo } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { useHlsSource } from "../video/useHlsSource.js";
import { useVideoTracking } from "../video/useVideoTracking.js";

export type VideoPlayerProps = {
  readonly lesson: ApiLesson;
  readonly video: ApiLessonVideo;
};

/**
 * The video of a lesson, on the browser's own accessible controls, with
 * watch verification (spec 06). Plays from a signed, short-lived URL.
 */
export function VideoPlayer({ lesson, video }: VideoPlayerProps) {
  const { i18n } = useElearning();
  const ref = useRef<HTMLVideoElement>(null);
  // Each lesson fetch signs a new URL; switching to it would restart playback.
  const [url] = useState(video.playback?.url ?? null);
  const { failed } = useHlsSource(ref, url);
  const { progress, seekBlocked } = useVideoTracking(ref, lesson, video.progress);

  if (url === null) {
    return <p className="el-video-pending">{i18n.t("video.processing")}</p>;
  }
  const percent = Math.round(progress.coverage * 100);
  return (
    <figure className="el-video">
      {/* Captions come as HLS subtitle tracks in the provider's manifest, or as the tracks
          mapped below; the rule cannot see mapped children. Missing captions are flagged to
          admins (spec 06, "Accessibility"; BACKLOG B-041). */}
      {/* eslint-disable-next-line jsx-a11y-x/media-has-caption -- see the comment above */}
      <video
        ref={ref}
        className="el-video-media"
        controls
        playsInline
        preload="metadata"
        aria-label={i18n.t("video.label", { title: lesson.title })}
        {...(video.thumbnail_url === null ? {} : { poster: video.thumbnail_url })}
      >
        {video.captions.map((caption) => (
          <track
            key={caption.lang}
            kind="captions"
            srcLang={caption.lang}
            src={caption.url}
            label={caption.lang}
          />
        ))}
      </video>
      <figcaption className="el-meta">
        <span role="status" aria-live="polite">
          {failed ? i18n.t("video.error") : i18n.t("video.watched", { percent })}
          {seekBlocked ? ` ${i18n.t("video.noSkipping")}` : null}
        </span>
      </figcaption>
    </figure>
  );
}

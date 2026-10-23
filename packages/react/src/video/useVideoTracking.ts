"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { ApiLesson, ApiVideoProgress } from "@bebranded/elearning-core";

import { queryKeys } from "../hooks/queries.js";
import { useElearning } from "../provider/context.js";
import { startMediaSession } from "./media-session.js";
import type { VideoSettings } from "./media-session.js";

function videoSettingsOf(lesson: ApiLesson): VideoSettings {
  const { allowSeeking, maxPlaybackRate, pauseWhenHidden } = lesson.settings;
  return {
    allowSeeking: allowSeeking !== false,
    maxPlaybackRate: typeof maxPlaybackRate === "number" ? maxPlaybackRate : 2,
    pauseWhenHidden: pauseWhenHidden === true,
  };
}

/** Starts a media session on the `<video>` and keeps the learner's progress up to date. */
export function useVideoTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  lesson: ApiLesson,
  initial: ApiVideoProgress,
) {
  const { api } = useElearning();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(initial);
  const [seekBlocked, setSeekBlocked] = useState(false);
  const status = useRef(lesson.status);
  // Refetches bring a new progress object; the session keeps the one it started from.
  const start = useRef(initial);
  const { allowSeeking, maxPlaybackRate, pauseWhenHidden } = videoSettingsOf(lesson);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;
    return startMediaSession(video, {
      initial: start.current,
      settings: { allowSeeking, maxPlaybackRate, pauseWhenHidden },
      send: (body, options) => api.videoHeartbeat(lesson.id, body, options),
      onSeekBlocked: () => {
        setSeekBlocked(true);
      },
      onResult: (result) => {
        setProgress(result.progress);
        if (result.status === status.current) return;
        // Completion changes the course page and dashboards: refresh them from the server.
        status.current = result.status;
        void queryClient.invalidateQueries({ queryKey: queryKeys.all });
      },
    });
  }, [videoRef, api, queryClient, lesson.id, allowSeeking, maxPlaybackRate, pauseWhenHidden]);

  return { progress, seekBlocked };
}

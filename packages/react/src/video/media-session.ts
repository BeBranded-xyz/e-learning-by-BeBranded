import type { ApiVideoHeartbeat, ApiVideoProgress } from "@bebranded/elearning-core";

import { HEARTBEAT_INTERVAL_MS, createHeartbeatSender } from "./heartbeat-sender.js";
import type { SendHeartbeat } from "./heartbeat-sender.js";
import { JUMP_TOLERANCE_SECONDS, createWatchTracker } from "./watch-tracker.js";

export type VideoSettings = {
  readonly allowSeeking: boolean;
  readonly maxPlaybackRate: number;
  readonly pauseWhenHidden: boolean;
};

export type MediaSessionOptions = {
  readonly initial: ApiVideoProgress;
  readonly settings: VideoSettings;
  readonly send: SendHeartbeat;
  readonly onResult: (result: ApiVideoHeartbeat) => void;
  /** The learner tried to skip past the furthest point watched while seeking is forbidden. */
  readonly onSeekBlocked: () => void;
};

const furthestOf = (progress: ApiVideoProgress) =>
  progress.watched_ranges.reduce((furthest, [, end]) => Math.max(furthest, end), 0);

function createSession(video: HTMLVideoElement, options: MediaSessionOptions) {
  const tracker = createWatchTracker();
  const sender = createHeartbeatSender({
    tracker,
    sessionId: crypto.randomUUID(),
    send: options.send,
    onResult: options.onResult,
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  const flush = (keepalive = false) => {
    void sender.flush(video.currentTime, video.playbackRate, { keepalive });
  };
  return {
    tracker,
    furthest: furthestOf(options.initial),
    flush,
    startTimer: () => {
      timer ??= setInterval(flush, HEARTBEAT_INTERVAL_MS);
    },
    stopTimer: () => {
      clearInterval(timer);
      timer = undefined;
    },
  };
}

type Session = ReturnType<typeof createSession>;

function stop(video: HTMLVideoElement, session: Session): void {
  session.tracker.pause(video.currentTime);
  session.stopTimer();
  session.flush();
}

function mediaHandlers(video: HTMLVideoElement, session: Session, options: MediaSessionOptions) {
  const { initial, settings } = options;
  return {
    loadedmetadata: () => {
      if (initial.last_position > 0 && initial.last_position < video.duration - 5)
        video.currentTime = initial.last_position;
    },
    play: () => {
      session.tracker.play(video.currentTime);
      session.startTimer();
    },
    timeupdate: () => {
      session.tracker.timeUpdate(video.currentTime);
      if (!video.paused && !video.seeking)
        session.furthest = Math.max(session.furthest, video.currentTime);
    },
    pause: () => {
      stop(video, session);
    },
    ended: () => {
      stop(video, session);
    },
    seeking: () => {
      session.tracker.seeking();
      const skipped = video.currentTime > session.furthest + JUMP_TOLERANCE_SECONDS;
      if (settings.allowSeeking || !skipped) return;
      video.currentTime = session.furthest;
      options.onSeekBlocked();
    },
    seeked: () => {
      if (!video.paused) session.tracker.play(video.currentTime);
    },
    ratechange: () => {
      if (video.playbackRate > settings.maxPlaybackRate)
        video.playbackRate = settings.maxPlaybackRate;
    },
  } satisfies Record<string, () => void>;
}

/**
 * Wires a `<video>` to watch verification (spec 06, "Client side"): tracks
 * played intervals, sends heartbeats every 15 s of playback and on pause,
 * end, hide and page exit, resumes at the last position, and applies the
 * lesson's seeking and speed limits. Returns the cleanup. The server re-checks
 * everything it is sent.
 */
export function startMediaSession(video: HTMLVideoElement, options: MediaSessionOptions) {
  const session = createSession(video, options);
  const handlers = Object.entries(mediaHandlers(video, session, options));
  const onVisibility = () => {
    if (document.visibilityState !== "hidden") return;
    if (options.settings.pauseWhenHidden) video.pause();
    session.flush(true);
  };
  const onPageHide = () => {
    session.tracker.pause(video.currentTime);
    session.flush(true);
  };
  for (const [event, handler] of handlers) video.addEventListener(event, handler);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    for (const [event, handler] of handlers) video.removeEventListener(event, handler);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    session.stopTimer();
  };
}

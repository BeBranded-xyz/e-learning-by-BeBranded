import { clampRanges, computeCoverage, mergeRanges, rangesLength } from "./ranges.js";
import type { VideoLessonSettings, WatchedRange } from "./video.schemas.js";

/** Fixed rules of watch verification (spec 06, "Server side"). */
export const VIDEO_TRACKING = {
  /** Slack on top of `maxPlaybackRate` for timer jitter and network delay. */
  plausibilityMargin: 1.1,
  /**
   * Most wall-clock time the budget can hold. The player reports every 15 s,
   * so this tolerates lost heartbeats without letting a long idle period pay
   * for a forged one.
   */
  maxCreditedGapSeconds: 60,
  /** How far past the furthest watched point a range may start when seeking is forbidden. */
  seekToleranceSeconds: 2,
  /** How far outside `[0, duration]` a range may reach before it is suspicious. */
  boundsToleranceSeconds: 1,
} as const;

export type VideoProgressState = {
  readonly watchedRanges: readonly WatchedRange[];
  readonly lastPosition: number;
  /**
   * Baseline of the time budget, across player sessions: the last accepted
   * heartbeat, moved back by the wall-clock time it did not use. Heartbeats
   * sent close together (pause, then end) keep the slack of the previous one.
   * Null before the first heartbeat.
   */
  readonly budgetBaselineAt: Date | null;
  readonly suspiciousEvents: number;
};

export type Heartbeat = {
  readonly ranges: readonly WatchedRange[];
  readonly position: number;
  readonly receivedAt: Date;
};

export type HeartbeatVideo = {
  /** From the provider, never from the client. */
  readonly durationSeconds: number;
  readonly settings: VideoLessonSettings;
  /** When the learner started the lesson: the time baseline of the first heartbeat. */
  readonly lessonStartedAt: Date;
};

export type HeartbeatOutcome = {
  readonly state: VideoProgressState;
  readonly watchedSeconds: number;
  readonly coverage: number;
  /** Coverage reached the lesson's completion threshold. */
  readonly completed: boolean;
  /** Part of the heartbeat was out of bounds, skipped ahead, or implausible. */
  readonly suspicious: boolean;
};

type Filtered = { readonly ranges: WatchedRange[]; readonly suspicious: boolean };

function withinBounds(ranges: readonly WatchedRange[], durationSeconds: number): Filtered {
  const tolerance = VIDEO_TRACKING.boundsToleranceSeconds;
  const suspicious = ranges.some(
    ([start, end]) => start < -tolerance || end > durationSeconds + tolerance,
  );
  return { ranges: mergeRanges(clampRanges(ranges, durationSeconds)), suspicious };
}

/** With `allowSeeking = false`, a range may not start past the furthest point watched. */
function withoutSkips(ranges: readonly WatchedRange[], watched: readonly WatchedRange[]): Filtered {
  let furthest = watched.at(-1)?.[1] ?? 0;
  const kept: WatchedRange[] = [];
  for (const range of ranges) {
    if (range[0] > furthest + VIDEO_TRACKING.seekToleranceSeconds) continue;
    kept.push(range);
    furthest = Math.max(furthest, range[1]);
  }
  return { ranges: kept, suspicious: kept.length < ranges.length };
}

/** Keeps the earliest ranges up to `budgetSeconds` of playback, truncating the last one. */
function withinBudget(ranges: readonly WatchedRange[], budgetSeconds: number): Filtered {
  let left = budgetSeconds;
  const kept: WatchedRange[] = [];
  for (const [start, end] of ranges) {
    if (left <= 0) break;
    const length = Math.min(end - start, left);
    kept.push([start, start + length]);
    left -= length;
  }
  return { ranges: kept, suspicious: rangesLength(kept) < rangesLength(ranges) };
}

/** Wall-clock time the budget holds at this heartbeat, and its baseline. */
function availableTime(previous: VideoProgressState, beat: Heartbeat, video: HeartbeatVideo) {
  const baseline = previous.budgetBaselineAt ?? video.lessonStartedAt;
  const elapsedSeconds = (beat.receivedAt.getTime() - baseline.getTime()) / 1000;
  const seconds = Math.min(Math.max(elapsedSeconds, 0), VIDEO_TRACKING.maxCreditedGapSeconds);
  return { seconds, baseline, clockWentBack: elapsedSeconds < 0 };
}

/** The next baseline keeps the unused time, so it is never lost between close heartbeats. */
function nextBaseline(
  available: ReturnType<typeof availableTime>,
  beat: Heartbeat,
  unusedSeconds: number,
): Date {
  if (available.clockWentBack) return available.baseline;
  // Dates hold whole milliseconds: round towards less credit, never more.
  return new Date(Math.ceil(beat.receivedAt.getTime() - unusedSeconds * 1000));
}

/**
 * Applies one heartbeat to a learner's video progress (spec 06, "Server
 * side"): bounds, forbidden skips and time plausibility first, then the union
 * with what was already watched. Duplicate `seq` values are filtered by the
 * caller before this runs.
 */
export function applyHeartbeat(
  previous: VideoProgressState,
  beat: Heartbeat,
  video: HeartbeatVideo,
): HeartbeatOutcome {
  const bounded = withinBounds(beat.ranges, video.durationSeconds);
  const ordered = video.settings.allowSeeking
    ? bounded
    : withoutSkips(bounded.ranges, previous.watchedRanges);
  const rate = video.settings.maxPlaybackRate * VIDEO_TRACKING.plausibilityMargin;
  const available = availableTime(previous, beat, video);
  const plausible = withinBudget(ordered.ranges, available.seconds * rate);
  const unusedSeconds = available.seconds - rangesLength(plausible.ranges) / rate;
  const suspicious = bounded.suspicious || ordered.suspicious || plausible.suspicious;

  const watchedRanges = mergeRanges(previous.watchedRanges, plausible.ranges);
  const coverage = computeCoverage(watchedRanges, video.durationSeconds);
  return {
    state: {
      watchedRanges,
      lastPosition: Math.min(Math.max(beat.position, 0), video.durationSeconds),
      budgetBaselineAt: nextBaseline(available, beat, unusedSeconds),
      suspiciousEvents: previous.suspiciousEvents + (suspicious ? 1 : 0),
    },
    watchedSeconds: rangesLength(watchedRanges),
    coverage,
    completed: coverage >= video.settings.completionThreshold,
    suspicious,
  };
}

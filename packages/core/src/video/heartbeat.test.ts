import { describe, expect, it } from "vitest";

import { applyHeartbeat } from "./heartbeat.js";
import { videoLessonSettingsSchema } from "./video.schemas.js";
import type { HeartbeatVideo, VideoProgressState } from "./heartbeat.js";
import type { VideoLessonSettings, WatchedRange } from "./video.schemas.js";

const START = new Date("2026-10-23T09:00:00.000Z");
const at = (seconds: number) => new Date(START.getTime() + seconds * 1000);

const fresh: VideoProgressState = {
  watchedRanges: [],
  lastPosition: 0,
  budgetBaselineAt: null,
  suspiciousEvents: 0,
};

function aVideo(settings: Partial<VideoLessonSettings> = {}): HeartbeatVideo {
  return {
    durationSeconds: 100,
    settings: videoLessonSettingsSchema.parse(settings),
    lessonStartedAt: START,
  };
}

function beat(ranges: WatchedRange[], seconds: number, position = ranges.at(-1)?.[1] ?? 0) {
  return { ranges, position, receivedAt: at(seconds) };
}

describe("applyHeartbeat, honest playback", () => {
  it("records the first 15 s of playback, measured from the lesson start", () => {
    const outcome = applyHeartbeat(fresh, beat([[0, 15]], 15), aVideo());

    // 15 s at up to 2.2x allow 33 s; 15 s were used, so 18 s of playback (8.18 s) carry over.
    expect(outcome.state).toEqual({
      watchedRanges: [[0, 15]],
      lastPosition: 15,
      budgetBaselineAt: new Date(Math.ceil(at(15).getTime() - (15 - 15 / 2.2) * 1000)),
      suspiciousEvents: 0,
    });
    expect(outcome.watchedSeconds).toBe(15);
    expect(outcome.coverage).toBe(0.15);
    expect(outcome.suspicious).toBe(false);
    expect(outcome.completed).toBe(false);
  });

  it("measures later heartbeats from the previous one", () => {
    const previous = {
      ...fresh,
      watchedRanges: [[0, 15]] as WatchedRange[],
      budgetBaselineAt: at(15),
    };

    const outcome = applyHeartbeat(previous, beat([[15, 30]], 30), aVideo());

    expect(outcome.state.watchedRanges).toEqual([[0, 30]]);
    expect(outcome.suspicious).toBe(false);
  });

  it("completes the lesson at the completion threshold", () => {
    const previous = {
      ...fresh,
      watchedRanges: [[0, 80]] as WatchedRange[],
      budgetBaselineAt: at(80),
    };

    const outcome = applyHeartbeat(previous, beat([[80, 95]], 95), aVideo());

    expect(outcome.coverage).toBe(0.95);
    expect(outcome.completed).toBe(true);
  });

  it("uses the lesson's own threshold", () => {
    const previous = {
      ...fresh,
      watchedRanges: [[0, 60]] as WatchedRange[],
      budgetBaselineAt: at(60),
    };

    const outcome = applyHeartbeat(
      previous,
      beat([[60, 75]], 75),
      aVideo({ completionThreshold: 0.8 }),
    );

    expect(outcome.completed).toBe(false);
  });

  it("allows playback at the maximum rate", () => {
    const outcome = applyHeartbeat(fresh, beat([[0, 30]], 15), aVideo({ maxPlaybackRate: 2 }));

    expect(outcome.state.watchedRanges).toEqual([[0, 30]]);
    expect(outcome.suspicious).toBe(false);
  });

  it("carries unused time to the next heartbeat, so close heartbeats at top speed all count", () => {
    const video = aVideo({ maxPlaybackRate: 2 });
    // Seen in the demo: the 15 s tick, then "pause" and "ended" a few milliseconds later.
    const first = applyHeartbeat(fresh, beat([[0, 29.75]], 15), video);

    const second = applyHeartbeat(first.state, beat([[29.75, 30]], 15.05), video);

    expect(second.state.watchedRanges).toEqual([[0, 30]]);
    expect(second.suspicious).toBe(false);
  });

  it("does not count rewatched parts twice", () => {
    const previous = {
      ...fresh,
      watchedRanges: [[0, 30]] as WatchedRange[],
      budgetBaselineAt: at(30),
    };

    const outcome = applyHeartbeat(previous, beat([[10, 25]], 45), aVideo());

    expect(outcome.watchedSeconds).toBe(30);
  });

  it("allows skipping ahead when seeking is allowed", () => {
    const outcome = applyHeartbeat(fresh, beat([[50, 60]], 15), aVideo({ allowSeeking: true }));

    expect(outcome.state.watchedRanges).toEqual([[50, 60]]);
    expect(outcome.suspicious).toBe(false);
  });

  it("tolerates a range that ends a fraction of a second past the video", () => {
    const previous = {
      ...fresh,
      watchedRanges: [[0, 90]] as WatchedRange[],
      budgetBaselineAt: at(90),
    };

    const outcome = applyHeartbeat(previous, beat([[90, 100.4]], 100), aVideo());

    expect(outcome.state.watchedRanges).toEqual([[0, 100]]);
    expect(outcome.coverage).toBe(1);
    expect(outcome.suspicious).toBe(false);
  });

  it("keeps the resume position inside the video", () => {
    expect(applyHeartbeat(fresh, beat([], 5, 250), aVideo()).state.lastPosition).toBe(100);
    expect(applyHeartbeat(fresh, beat([], 5, -3), aVideo()).state.lastPosition).toBe(0);
  });
});

describe("applyHeartbeat, forged or skipped playback", () => {
  it("truncates a claim of the whole video in 15 s to what the elapsed time allows", () => {
    const outcome = applyHeartbeat(fresh, beat([[0, 100]], 15), aVideo({ maxPlaybackRate: 1 }));

    expect(outcome.state.watchedRanges).toEqual([[0, 16.5]]);
    expect(outcome.suspicious).toBe(true);
    expect(outcome.state.suspiciousEvents).toBe(1);
    expect(outcome.completed).toBe(false);
  });

  it("credits at most 60 s of wall-clock time to a single heartbeat", () => {
    const previous = { ...fresh, budgetBaselineAt: at(0) };

    const outcome = applyHeartbeat(
      previous,
      beat([[0, 100]], 3600),
      aVideo({ maxPlaybackRate: 1 }),
    );

    expect(outcome.watchedSeconds).toBeCloseTo(66);
    expect(outcome.suspicious).toBe(true);
  });

  it("credits nothing when the heartbeat arrives before its baseline", () => {
    const previous = { ...fresh, budgetBaselineAt: at(30) };

    const outcome = applyHeartbeat(previous, beat([[0, 10]], 20), aVideo());

    expect(outcome.watchedSeconds).toBe(0);
    expect(outcome.suspicious).toBe(true);
  });

  it("keeps the earliest ranges when several exceed the budget", () => {
    const outcome = applyHeartbeat(
      fresh,
      beat(
        [
          [40, 50],
          [0, 10],
        ],
        10,
      ),
      aVideo({ maxPlaybackRate: 1 }),
    );

    expect(outcome.state.watchedRanges).toEqual([
      [0, 10],
      [40, 41],
    ]);
  });

  it("flags and clamps ranges outside the video", () => {
    const outcome = applyHeartbeat(
      fresh,
      beat(
        [
          [-10, 5],
          [95, 130],
        ],
        30,
      ),
      aVideo(),
    );

    expect(outcome.state.watchedRanges).toEqual([
      [0, 5],
      [95, 100],
    ]);
    expect(outcome.suspicious).toBe(true);
  });

  it("drops ranges past the furthest watched point when seeking is forbidden", () => {
    const previous = {
      ...fresh,
      watchedRanges: [[0, 20]] as WatchedRange[],
      budgetBaselineAt: at(20),
    };

    const outcome = applyHeartbeat(
      previous,
      beat(
        [
          [20, 30],
          [80, 90],
        ],
        35,
      ),
      aVideo({ allowSeeking: false }),
    );

    expect(outcome.state.watchedRanges).toEqual([[0, 30]]);
    expect(outcome.suspicious).toBe(true);
  });

  it("accepts a range within the seek tolerance when seeking is forbidden", () => {
    const previous = {
      ...fresh,
      watchedRanges: [[0, 20]] as WatchedRange[],
      budgetBaselineAt: at(20),
    };

    const outcome = applyHeartbeat(
      previous,
      beat([[21.5, 30]], 35),
      aVideo({ allowSeeking: false }),
    );

    expect(outcome.state.watchedRanges).toEqual([
      [0, 20],
      [21.5, 30],
    ]);
    expect(outcome.suspicious).toBe(false);
  });

  it("forbids starting past the beginning of an unwatched video when seeking is forbidden", () => {
    const outcome = applyHeartbeat(fresh, beat([[50, 60]], 15), aVideo({ allowSeeking: false }));

    expect(outcome.state.watchedRanges).toEqual([]);
    expect(outcome.suspicious).toBe(true);
  });

  it("adds to the existing count of suspicious events", () => {
    const previous = { ...fresh, suspiciousEvents: 4 };

    const outcome = applyHeartbeat(previous, beat([[0, 100]], 1), aVideo());

    expect(outcome.state.suspiciousEvents).toBe(5);
  });
});

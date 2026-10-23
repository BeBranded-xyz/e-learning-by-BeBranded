import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { VIDEO_TRACKING, applyHeartbeat } from "./heartbeat.js";
import { rangesLength } from "./ranges.js";
import { videoLessonSettingsSchema } from "./video.schemas.js";
import type { HeartbeatVideo, VideoProgressState } from "./heartbeat.js";
import type { WatchedRange } from "./video.schemas.js";

const START = new Date("2026-10-23T09:00:00.000Z");
const DURATION = 600;

const rangeArb: fc.Arbitrary<WatchedRange> = fc
  .tuple(
    fc.double({ min: -50, max: 650, noNaN: true }),
    fc.double({ min: 0, max: 700, noNaN: true }),
  )
  .map(([start, length]) => [start, start + length]);
type Beat = { ranges: WatchedRange[]; position: number; afterSeconds: number };
const beatArb: fc.Arbitrary<Beat> = fc.record({
  ranges: fc.array(rangeArb, { maxLength: 8 }),
  position: fc.double({ min: -100, max: 1000, noNaN: true }),
  afterSeconds: fc.integer({ min: 0, max: 600 }),
});
const videoArb: fc.Arbitrary<HeartbeatVideo> = fc
  .record({
    completionThreshold: fc.double({ min: 0.5, max: 1, noNaN: true }),
    allowSeeking: fc.boolean(),
    maxPlaybackRate: fc.double({ min: 1, max: 4, noNaN: true }),
  })
  .map((settings) => ({
    durationSeconds: DURATION,
    settings: videoLessonSettingsSchema.parse(settings),
    lessonStartedAt: START,
  }));

const fresh: VideoProgressState = {
  watchedRanges: [],
  lastPosition: 0,
  budgetBaselineAt: null,
  suspiciousEvents: 0,
};

/** Replays a sequence of heartbeats, each sent `afterSeconds` after the previous one. */
function replay(beats: readonly Beat[], video: HeartbeatVideo) {
  let state = fresh;
  let clock = START.getTime();
  let credited = 0;
  for (const { ranges, position, afterSeconds } of beats) {
    clock += afterSeconds * 1000;
    const before = rangesLength(state.watchedRanges);
    const outcome = applyHeartbeat(state, { ranges, position, receivedAt: new Date(clock) }, video);
    credited += rangesLength(outcome.state.watchedRanges) - before;
    state = outcome.state;
  }
  return { state, credited, elapsedSeconds: (clock - START.getTime()) / 1000 };
}

describe("applyHeartbeat properties", () => {
  it("never credits more playback than the elapsed time allows", () => {
    fc.assert(
      fc.property(fc.array(beatArb, { maxLength: 10 }), videoArb, (beats, video) => {
        const { credited, elapsedSeconds } = replay(beats, video);
        const limit =
          elapsedSeconds * video.settings.maxPlaybackRate * VIDEO_TRACKING.plausibilityMargin;

        expect(credited).toBeLessThanOrEqual(limit + 1e-6);
      }),
    );
  });

  it("keeps watched ranges inside the video, so coverage stays between 0 and 1", () => {
    fc.assert(
      fc.property(fc.array(beatArb, { maxLength: 10 }), videoArb, (beats, video) => {
        const { state } = replay(beats, video);

        state.watchedRanges.forEach(([start, end]) => {
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(DURATION);
        });
        expect(state.lastPosition).toBeGreaterThanOrEqual(0);
        expect(state.lastPosition).toBeLessThanOrEqual(DURATION);
      }),
    );
  });

  it("never loses what was already watched", () => {
    fc.assert(
      fc.property(fc.array(beatArb, { minLength: 1, maxLength: 10 }), videoArb, (beats, video) => {
        let state = fresh;
        let clock = START.getTime();
        for (const { ranges, position, afterSeconds } of beats) {
          clock += afterSeconds * 1000;
          const before = rangesLength(state.watchedRanges);
          state = applyHeartbeat(
            state,
            { ranges, position, receivedAt: new Date(clock) },
            video,
          ).state;

          expect(rangesLength(state.watchedRanges)).toBeGreaterThanOrEqual(before - 1e-9);
        }
      }),
    );
  });

  it("counts at most one suspicious event per heartbeat", () => {
    fc.assert(
      fc.property(fc.array(beatArb, { maxLength: 10 }), videoArb, (beats, video) => {
        expect(replay(beats, video).state.suspiciousEvents).toBeLessThanOrEqual(beats.length);
      }),
    );
  });
});

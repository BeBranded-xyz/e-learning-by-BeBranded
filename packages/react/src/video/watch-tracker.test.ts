import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createWatchTracker } from "./watch-tracker.js";

/** Plays from `from` to `to` in steps of `step` seconds, like `timeupdate` events. */
function playThrough(
  tracker: ReturnType<typeof createWatchTracker>,
  from: number,
  to: number,
  step = 0.25,
) {
  tracker.play(from);
  for (let time = from + step; time <= to + 1e-9; time += step) tracker.timeUpdate(time);
}

describe("createWatchTracker", () => {
  it("records continuous playback until pause", () => {
    const tracker = createWatchTracker();

    playThrough(tracker, 0, 15);
    tracker.pause(15);

    expect(tracker.drain()).toEqual([[0, 15]]);
  });

  it("splits an interval that is still playing, without resending it", () => {
    const tracker = createWatchTracker();

    playThrough(tracker, 0, 10);
    const first = tracker.drain();
    playThrough(tracker, 10, 20);
    tracker.pause(20);

    expect(first).toEqual([[0, 10]]);
    expect(tracker.drain()).toEqual([[10, 20]]);
  });

  it("ends the interval at a jump forward of more than 2 seconds", () => {
    const tracker = createWatchTracker();

    playThrough(tracker, 0, 5);
    tracker.timeUpdate(30);
    tracker.timeUpdate(31);
    tracker.pause(31);

    expect(tracker.drain()).toEqual([
      [0, 5],
      [30, 31],
    ]);
  });

  it("ends the interval when time goes backwards", () => {
    const tracker = createWatchTracker();

    playThrough(tracker, 10, 12);
    tracker.timeUpdate(4);
    tracker.timeUpdate(5);
    tracker.pause(5);

    expect(tracker.drain()).toEqual([
      [10, 12],
      [4, 5],
    ]);
  });

  it("does not count what is crossed while seeking", () => {
    const tracker = createWatchTracker();

    playThrough(tracker, 0, 3);
    tracker.seeking();
    tracker.timeUpdate(4);

    expect(tracker.drain()).toEqual([[0, 3]]);
  });

  it("ignores time updates before play and empty intervals", () => {
    const tracker = createWatchTracker();

    tracker.timeUpdate(10);
    tracker.play(5);
    tracker.pause(5);

    expect(tracker.drain()).toEqual([]);
  });

  it("puts back intervals before newer ones", () => {
    const tracker = createWatchTracker();
    playThrough(tracker, 20, 25);
    tracker.pause(25);

    tracker.restore([[0, 5]]);

    expect(tracker.drain()).toEqual([
      [0, 5],
      [20, 25],
    ]);
  });

  it("never reports more than the playback steps of at most 2 seconds", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -5, max: 10, noNaN: true }), { maxLength: 50 }),
        (steps) => {
          const tracker = createWatchTracker();
          let time = 0;
          let played = 0;
          tracker.play(0);
          for (const step of steps) {
            time = Math.max(0, time + step);
            if (step >= 0 && step <= 2) played += step;
            tracker.timeUpdate(time);
          }
          const reported = tracker.drain().reduce((sum, [start, end]) => sum + (end - start), 0);

          expect(reported).toBeLessThanOrEqual(played + 1e-6);
        },
      ),
    );
  });
});

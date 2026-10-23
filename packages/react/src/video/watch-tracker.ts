import type { WatchedRange } from "@bebranded/elearning-core";

/** A gap between two `timeupdate` events larger than this is a jump, not playback (spec 06). */
export const JUMP_TOLERANCE_SECONDS = 2;

type Open = { start: number; end: number };

/**
 * Collects the intervals a learner actually played, from media events
 * (spec 06, "Client side"). Pure: the player feeds it times, the heartbeat
 * sender drains it. The server re-checks everything; this only reports.
 */
export function createWatchTracker() {
  let open: Open | null = null;
  let pending: WatchedRange[] = [];

  function close(): void {
    if (open !== null && open.end > open.start) pending.push([open.start, open.end]);
    open = null;
  }

  function timeUpdate(time: number): void {
    if (open === null) return;
    const step = time - open.end;
    if (step >= 0 && step <= JUMP_TOLERANCE_SECONDS) {
      open.end = time;
      return;
    }
    // A jump, forwards or backwards, ends the interval; playback resumes from here.
    close();
    open = { start: time, end: time };
  }

  return {
    play(time: number): void {
      close();
      open = { start: time, end: time };
    },
    timeUpdate,
    pause(time: number): void {
      timeUpdate(time);
      close();
    },
    /** Intervals crossed while seeking do not count. */
    seeking(): void {
      close();
    },
    /** New intervals since the last drain; an interval still playing is split, never resent. */
    drain(): WatchedRange[] {
      const drained = pending;
      pending = [];
      if (open !== null && open.end > open.start) {
        drained.push([open.start, open.end]);
        open = { start: open.end, end: open.end };
      }
      return drained;
    },
    /** Puts back intervals whose heartbeat could not be sent. */
    restore(ranges: readonly WatchedRange[]): void {
      pending = [...ranges, ...pending];
    },
  };
}

export type WatchTracker = ReturnType<typeof createWatchTracker>;

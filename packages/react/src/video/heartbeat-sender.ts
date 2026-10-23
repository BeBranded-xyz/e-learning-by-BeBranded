import type { ApiVideoHeartbeat, WatchedRange } from "@bebranded/elearning-core";

import type { WatchTracker } from "./watch-tracker.js";

/** Spec 06: a heartbeat every 15 s of playback, plus on pause, end, hide and page exit. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

export type HeartbeatBody = {
  readonly session_id: string;
  readonly seq: number;
  readonly ranges: readonly WatchedRange[];
  readonly position: number;
  readonly playback_rate: number;
};

export type SendHeartbeat = (
  body: HeartbeatBody,
  options: { readonly keepalive: boolean },
) => Promise<ApiVideoHeartbeat>;

/**
 * Sends the tracker's intervals one heartbeat at a time, in `seq` order, so
 * the server never sees a later `seq` before an earlier one (it would drop
 * the earlier one as a replay). A failed send puts its intervals back. The
 * last heartbeat on page exit (`keepalive`) does not wait: the page is going.
 */
export function createHeartbeatSender(input: {
  readonly tracker: WatchTracker;
  readonly send: SendHeartbeat;
  readonly sessionId: string;
  readonly onResult: (result: ApiVideoHeartbeat) => void;
}) {
  let seq = 0;
  let queue: Promise<void> = Promise.resolve();

  async function sendOne(position: number, playbackRate: number, keepalive: boolean) {
    const ranges = input.tracker.drain();
    const body = {
      session_id: input.sessionId,
      seq,
      ranges,
      position,
      playback_rate: playbackRate,
    };
    seq += 1;
    try {
      input.onResult(await input.send(body, { keepalive }));
    } catch {
      // Network or server failure: the intervals go out with the next heartbeat.
      input.tracker.restore(ranges);
    }
  }

  return {
    flush(position: number, playbackRate: number, options = { keepalive: false }): Promise<void> {
      if (options.keepalive) return sendOne(position, playbackRate, true);
      queue = queue.then(() => sendOne(position, playbackRate, false));
      return queue;
    },
  };
}

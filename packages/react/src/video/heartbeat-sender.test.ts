import { describe, expect, it } from "vitest";

import type { ApiVideoHeartbeat } from "@bebranded/elearning-core";

import { createHeartbeatSender } from "./heartbeat-sender.js";
import type { HeartbeatBody } from "./heartbeat-sender.js";
import { createWatchTracker } from "./watch-tracker.js";

const SESSION = "00000000-0000-4000-8000-000000000001";
const result: ApiVideoHeartbeat = {
  accepted: true,
  status: "in_progress",
  progress: { watched_seconds: 5, coverage: 0.1, last_position: 5, watched_ranges: [[0, 5]] },
};

function setup(send: (body: HeartbeatBody) => Promise<ApiVideoHeartbeat>) {
  const tracker = createWatchTracker();
  const results: ApiVideoHeartbeat[] = [];
  const sender = createHeartbeatSender({
    tracker,
    sessionId: SESSION,
    send,
    onResult: (value) => results.push(value),
  });
  return { tracker, sender, results };
}

describe("createHeartbeatSender", () => {
  it("sends drained intervals with increasing seq and reports the result", async () => {
    const sent: HeartbeatBody[] = [];
    const { tracker, sender, results } = setup((body) => {
      sent.push(body);
      return Promise.resolve(result);
    });
    tracker.play(0);
    tracker.timeUpdate(1);
    tracker.pause(1);

    await sender.flush(1, 1.5);
    await sender.flush(1, 1.5);

    expect(sent).toEqual([
      { session_id: SESSION, seq: 0, ranges: [[0, 1]], position: 1, playback_rate: 1.5 },
      { session_id: SESSION, seq: 1, ranges: [], position: 1, playback_rate: 1.5 },
    ]);
    expect(results).toEqual([result, result]);
  });

  it("sends one heartbeat at a time, in seq order", async () => {
    const order: number[] = [];
    let release = () => undefined as unknown;
    const { sender } = setup(
      (body) =>
        new Promise((resolve) => {
          order.push(body.seq);
          release = () => {
            resolve(result);
          };
        }),
    );

    const first = sender.flush(0, 1);
    const second = sender.flush(0, 1);
    await Promise.resolve();
    expect(order).toEqual([0]);
    release();
    await first;
    await Promise.resolve();
    release();
    await second;

    expect(order).toEqual([0, 1]);
  });

  it("sends a keepalive heartbeat at once, without waiting for one in flight", async () => {
    const tracker = createWatchTracker();
    const sent: { seq: number; keepalive: boolean }[] = [];
    const sender = createHeartbeatSender({
      tracker,
      sessionId: SESSION,
      // A regular heartbeat that never answers, then the page is left.
      send: (body, options) => {
        sent.push({ seq: body.seq, keepalive: options.keepalive });
        return options.keepalive ? Promise.resolve(result) : new Promise(() => undefined);
      },
      onResult: () => undefined,
    });

    void sender.flush(0, 1);
    await Promise.resolve();
    await sender.flush(0, 1, { keepalive: true });

    expect(sent).toEqual([
      { seq: 0, keepalive: false },
      { seq: 1, keepalive: true },
    ]);
  });

  it("puts intervals back when a heartbeat fails, and sends them with the next one", async () => {
    const sent: HeartbeatBody[] = [];
    let fail = true;
    const { tracker, sender, results } = setup((body) => {
      sent.push(body);
      if (fail) return Promise.reject(new Error("offline"));
      return Promise.resolve(result);
    });
    tracker.play(0);
    tracker.timeUpdate(2);
    tracker.pause(2);

    await sender.flush(2, 1);
    fail = false;
    await sender.flush(2, 1);

    expect(sent.map((body) => body.ranges)).toEqual([[[0, 2]], [[0, 2]]]);
    expect(sent.map((body) => body.seq)).toEqual([0, 1]);
    expect(results).toHaveLength(1);
  });
});

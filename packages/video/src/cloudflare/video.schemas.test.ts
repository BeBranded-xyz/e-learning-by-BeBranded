import { describe, expect, it } from "vitest";

import { erroredVideo, pendingVideo, readyVideo } from "../../tests/fixtures/stream.js";
import { streamVideoSchema, toSnapshot } from "./video.schemas.js";

const parse = (video: unknown) => toSnapshot(streamVideoSchema.parse(video));

describe("toSnapshot", () => {
  it("maps a ready video with its duration and thumbnail", () => {
    expect(parse(readyVideo)).toEqual({
      status: "ready",
      durationSeconds: 5.5,
      thumbnailUrl: readyVideo.thumbnail,
    });
  });

  it("maps a video waiting for its upload", () => {
    expect(parse(pendingVideo)).toEqual({
      status: "uploading",
      durationSeconds: null,
      thumbnailUrl: null,
    });
  });

  it("maps the documented error example, whatever the reason field spelling", () => {
    expect(parse(erroredVideo)).toEqual({
      status: "error",
      durationSeconds: null,
      thumbnailUrl: null,
    });
  });

  it.each(["downloading", "queued", "inprogress", "live-inprogress"])(
    "treats the %s state as processing",
    (state) => {
      expect(parse({ ...pendingVideo, status: { state } }).status).toBe("processing");
    },
  );

  it("keeps a ready video that is not yet playable in processing", () => {
    expect(parse({ ...readyVideo, readyToStream: false }).status).toBe("processing");
  });

  it("keeps a ready video without a known duration in processing", () => {
    expect(parse({ ...readyVideo, duration: -1 })).toMatchObject({
      status: "processing",
      durationSeconds: null,
    });
  });

  it("rejects an unknown state or a missing uid", () => {
    expect(streamVideoSchema.safeParse({ ...readyVideo, status: { state: "gone" } }).success).toBe(
      false,
    );
    expect(streamVideoSchema.safeParse({ status: { state: "ready" } }).success).toBe(false);
  });
});

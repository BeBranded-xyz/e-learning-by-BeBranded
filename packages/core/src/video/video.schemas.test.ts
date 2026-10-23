import { describe, expect, it } from "vitest";

import { videoAssetStatusSchema, videoLessonSettingsSchema } from "./video.schemas.js";

describe("videoLessonSettingsSchema", () => {
  it("fills the defaults of spec 06", () => {
    expect(videoLessonSettingsSchema.parse({})).toEqual({
      completionThreshold: 0.95,
      allowSeeking: true,
      maxPlaybackRate: 2,
      pauseWhenHidden: false,
    });
  });

  it("keeps valid values", () => {
    const settings = {
      completionThreshold: 0.8,
      allowSeeking: false,
      maxPlaybackRate: 1.5,
      pauseWhenHidden: true,
    };

    expect(videoLessonSettingsSchema.parse(settings)).toEqual(settings);
  });

  it.each([
    ["a threshold below 0.5", { completionThreshold: 0.4 }],
    ["a threshold above 1", { completionThreshold: 1.1 }],
    ["a playback rate below 1", { maxPlaybackRate: 0.5 }],
    ["a playback rate above 4", { maxPlaybackRate: 16 }],
    ["a non-boolean seeking flag", { allowSeeking: "false" }],
    ["an unknown option", { autoplay: true }],
  ])("rejects %s", (_name, input) => {
    expect(videoLessonSettingsSchema.safeParse(input).success).toBe(false);
  });
});

describe("videoAssetStatusSchema", () => {
  it("accepts the four statuses of spec 03 and nothing else", () => {
    expect(videoAssetStatusSchema.options).toEqual(["uploading", "processing", "ready", "error"]);
    expect(videoAssetStatusSchema.safeParse("deleted").success).toBe(false);
  });
});

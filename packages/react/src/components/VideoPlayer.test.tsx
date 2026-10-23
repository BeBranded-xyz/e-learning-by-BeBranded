import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiLesson, ApiVideoHeartbeat } from "@bebranded/elearning-core";

import { readyVideo, videoLesson } from "../../tests/fixtures.js";
import { a11yViolations, renderWithProvider } from "../../tests/render.js";
import { LessonPlayer } from "../containers/LessonPlayer.js";
import { LessonView } from "./LessonView.js";

type HlsHandler = (event: string, data: { fatal: boolean }) => void;

const hls = vi.hoisted(() => ({
  supported: true,
  instances: [] as { source: string; media: unknown; destroyed: boolean; error: HlsHandler }[],
}));

vi.mock("hls.js", () => ({
  default: class {
    static Events = { ERROR: "hlsError" };
    static isSupported = () => hls.supported;
    readonly state = {
      source: "",
      media: null as unknown,
      destroyed: false,
      error: (() => undefined) as HlsHandler,
    };
    constructor() {
      hls.instances.push(this.state);
    }
    on(_event: string, handler: HlsHandler) {
      this.state.error = handler;
    }
    loadSource(url: string) {
      this.state.source = url;
    }
    attachMedia(media: unknown) {
      this.state.media = media;
    }
    destroy() {
      this.state.destroyed = true;
    }
  },
}));

afterEach(() => {
  hls.instances.length = 0;
  hls.supported = true;
  vi.useRealTimers();
});

const path = `/lessons/${videoLesson.id}`;
const heartbeatResult = (overrides: Partial<ApiVideoHeartbeat> = {}): ApiVideoHeartbeat => ({
  accepted: true,
  status: "in_progress",
  progress: { watched_seconds: 15, coverage: 0.25, last_position: 15, watched_ranges: [[0, 15]] },
  ...overrides,
});

/** jsdom has no media pipeline: the test drives the element's playback state. */
function mediaOf(video: HTMLVideoElement) {
  const state = { currentTime: 0, duration: 60, paused: true, seeking: false, playbackRate: 1 };
  for (const key of Object.keys(state) as (keyof typeof state)[]) {
    Object.defineProperty(video, key, {
      configurable: true,
      get: () => state[key],
      set: (value: never) => {
        state[key] = value;
      },
    });
  }
  const pauseMock = vi.fn(() => {
    state.paused = true;
  });
  video.pause = pauseMock;
  const at = (time: number) => {
    state.currentTime = time;
    fireEvent.timeUpdate(video);
  };
  return {
    state,
    pauseMock,
    play: (from: number, to: number) => {
      state.currentTime = from;
      state.paused = false;
      fireEvent.play(video);
      for (let time = from + 0.25; time <= to; time += 0.25) at(time);
    },
    pause: () => {
      state.paused = true;
      fireEvent.pause(video);
    },
  };
}

function renderLesson(lesson: ApiLesson = videoLesson, reply = heartbeatResult()) {
  const result = renderWithProvider(<LessonView lesson={lesson} />, {
    [`POST ${path}/video-progress`]: { body: reply },
    [`GET ${path}`]: { body: lesson },
  });
  const video = result.container.querySelector("video");
  if (video === null) throw new Error("no video element");
  return { ...result, video, media: mediaOf(video) };
}

const heartbeats = (requests: { key: string; body: unknown; keepalive: boolean }[]) =>
  requests.filter((request) => request.key === `POST ${path}/video-progress`);

describe("VideoPlayer", () => {
  it("renders an accessible, labelled video with its poster and captions, through hls.js", async () => {
    const { video, container } = renderLesson();

    expect(screen.getByLabelText("Video: Safety video")).toBe(video);
    expect(video.getAttribute("poster")).toBe("https://videos.example.com/thumb.jpg");
    expect(video.querySelector("track")?.getAttribute("srclang")).toBe("fr");
    await waitFor(() => {
      expect(hls.instances[0]?.source).toBe("https://videos.example.com/video.m3u8");
    });
    expect(hls.instances[0]?.media).toBe(video);
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("plays natively where the browser supports HLS, without loading hls.js", () => {
    const spy = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("maybe");

    const { video } = renderLesson();

    expect(video.getAttribute("src")).toBe("https://videos.example.com/video.m3u8");
    expect(hls.instances).toEqual([]);
    spy.mockRestore();
  });

  it("explains that a video is still being prepared", () => {
    const pending = { ...videoLesson, video: { ...readyVideo, playback: null } };

    renderWithProvider(<LessonView lesson={pending} />, {});

    expect(
      screen.getByText("This video is being prepared. Come back in a few minutes."),
    ).toBeDefined();
  });

  it("sends the played interval on pause and shows the server's coverage", async () => {
    const { media, requests } = renderLesson();

    media.play(0, 15);
    media.pause();

    expect(await screen.findByText("25% watched")).toBeDefined();
    expect(heartbeats(requests)[0]?.body).toEqual({
      session_id: expect.any(String) as string,
      seq: 0,
      ranges: [[0, 15]],
      position: 15,
      playback_rate: 1,
    });
  });

  it("sends a heartbeat every 15 seconds of playback", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { media, requests } = renderLesson();

    media.play(0, 10);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(heartbeats(requests)).toHaveLength(1);
    expect(heartbeats(requests)[0]?.body).toMatchObject({ ranges: [[0, 10]] });
  });

  it("sends the last heartbeat with keepalive when the page is left", () => {
    const { media, requests } = renderLesson();

    media.play(0, 5);
    fireEvent(window, new Event("pagehide"));

    expect(heartbeats(requests).at(-1)).toMatchObject({
      keepalive: true,
      body: { ranges: [[0, 5]] },
    });
  });

  it("brings the learner back when skipping ahead is forbidden", async () => {
    const strict = { ...videoLesson, settings: { ...videoLesson.settings, allowSeeking: false } };
    const { video, media } = renderLesson(strict);
    media.play(0, 10);

    media.state.currentTime = 40;
    fireEvent.seeking(video);

    expect(media.state.currentTime).toBe(10);
    expect(await screen.findByText(/You can't skip ahead in this video./)).toBeDefined();
  });

  it("lets the learner seek when the lesson allows it", () => {
    const { video, media } = renderLesson();

    media.state.currentTime = 40;
    fireEvent.seeking(video);

    expect(media.state.currentTime).toBe(40);
  });

  it("caps the playback speed at the lesson's maximum", () => {
    const { video, media } = renderLesson();

    media.state.playbackRate = 4;
    fireEvent.rateChange(video);

    expect(media.state.playbackRate).toBe(2);
  });

  it("resumes at the last position", () => {
    const resumed = {
      ...videoLesson,
      video: {
        ...readyVideo,
        progress: { ...readyVideo.progress, last_position: 20 },
      },
    };
    const { video, media } = renderLesson(resumed);

    fireEvent.loadedMetadata(video);

    expect(media.state.currentTime).toBe(20);
  });

  it("pauses when the tab is hidden if the lesson asks for it", () => {
    const hidden = { ...videoLesson, settings: { ...videoLesson.settings, pauseWhenHidden: true } };
    const { media } = renderLesson(hidden);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    fireEvent(document, new Event("visibilitychange"));

    expect(media.pauseMock).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("refreshes the lesson once the server reports it completed", async () => {
    const { calls, container } = renderWithProvider(<LessonPlayer lessonId={videoLesson.id} />, {
      [`GET ${path}`]: { body: videoLesson },
      [`POST ${path}/start`]: { body: { status: "in_progress", enrollment: null } },
      [`POST ${path}/video-progress`]: { body: heartbeatResult({ status: "completed" }) },
    });
    await screen.findByLabelText("Video: Safety video");
    const video = container.querySelector("video");
    if (video === null) throw new Error("no video element");
    const media = mediaOf(video);

    media.play(0, 15);
    media.pause();

    await waitFor(() => {
      expect(calls.filter((call) => call === `GET ${path}`).length).toBeGreaterThan(1);
    });
  });

  it("tells the learner when the stream cannot be played", async () => {
    renderLesson();
    await waitFor(() => {
      expect(hls.instances).toHaveLength(1);
    });

    act(() => {
      hls.instances[0]?.error("hlsError", { fatal: true });
    });

    expect(await screen.findByText(/The video could not be played/)).toBeDefined();
  });

  it("tells the learner when the browser cannot play HLS at all", async () => {
    hls.supported = false;

    renderLesson();

    expect(await screen.findByText(/The video could not be played/)).toBeDefined();
  });

  it("stops hls.js when the player goes away", async () => {
    const { unmount } = renderLesson();
    await waitFor(() => {
      expect(hls.instances).toHaveLength(1);
    });

    unmount();

    expect(hls.instances[0]?.destroyed).toBe(true);
  });
});

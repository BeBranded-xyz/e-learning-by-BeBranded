import { afterEach, describe, expect, it, vi } from "vitest";
import { verify } from "../demo-files";
import {
  acquireEncoder,
  consumeTicket,
  createTicket,
  findTicket,
  MAX_VIDEO_BYTES,
  releaseEncoder,
  terms,
} from "./tickets";
import { isVideoContainer } from "./encode";

afterEach(() => {
  vi.useRealTimers();
  releaseEncoder();
  releaseEncoder();
});

describe("demo video upload boundary", () => {
  it.each([0, -1, 0.5, MAX_VIDEO_BYTES + 1, undefined])(
    "refuses invalid byte length %s",
    (sizeBytes) => {
      expect(() => createTicket({ sizeBytes, maxDurationSeconds: 900 })).toThrow();
    },
  );
  it("issues a one-use, short-lived, signed ticket with a bounded duration", () => {
    const created = createTicket({ sizeBytes: 1024, maxDurationSeconds: 3600 });
    const ticket = findTicket(created.assetId);
    expect(ticket?.maxDuration).toBe(900);
    expect(created.protocol).toBe("form");
    if (ticket === undefined) throw new Error("ticket missing");
    const url = new URL(created.uploadUrl, "https://demo.example.com");
    expect(verify("put", created.assetId, url.searchParams, terms(ticket))).toBe(true);
    expect(verify("put", created.assetId, url.searchParams, "changed size")).toBe(false);
    consumeTicket(created.assetId);
    expect(findTicket(created.assetId)).toBeUndefined();
    vi.useFakeTimers();
    vi.advanceTimersByTime(901_000);
    expect(verify("put", created.assetId, url.searchParams, terms(ticket))).toBe(false);
  });
  it("bounds encoders and releases them for later uploads", () => {
    expect(acquireEncoder()).toBe(true);
    expect(acquireEncoder()).toBe(true);
    expect(acquireEncoder()).toBe(false);
    releaseEncoder();
    expect(acquireEncoder()).toBe(true);
  });
  it("accepts container signatures and refuses playlists, scripts and arbitrary bytes", () => {
    expect(isVideoContainer(Buffer.from("0000ftypisom"))).toBe(true);
    expect(isVideoContainer(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true);
    expect(isVideoContainer(Buffer.from("#EXTM3U\nfile:///private/secret"))).toBe(false);
    expect(isVideoContainer(Buffer.from("<script>alert(1)</script>"))).toBe(false);
    expect(isVideoContainer(new Uint8Array())).toBe(false);
  });
});

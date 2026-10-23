import { describe, expect, it } from "vitest";

import { learnerIdSchema } from "@bebranded/elearning-core";

import { fakeVideoProvider } from "./fake-video-provider.js";

const now = new Date("2026-10-23T09:00:00.000Z");
const learnerId = learnerIdSchema.parse("learner-1");

function aProvider() {
  return fakeVideoProvider({
    playbackUrl: (assetId) => `https://videos.example.com/${assetId}.m3u8`,
    webhookSecret: "fake-secret",
    now: () => now,
  });
}

function aWebhook(body: unknown, secret = "fake-secret") {
  return new Request("https://host.example.com/webhook", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("fakeVideoProvider", () => {
  it("creates uploading assets, then reads and deletes them", async () => {
    const provider = aProvider();

    const { assetId, uploadUrl } = await provider.createDirectUpload({ maxDurationSeconds: 60 });

    expect(uploadUrl).toBe(`https://upload.example.com/${assetId}`);
    expect(await provider.getAsset(assetId)).toEqual({
      status: "uploading",
      durationSeconds: null,
      thumbnailUrl: null,
    });
    await provider.deleteAsset(assetId);
    await expect(provider.getAsset(assetId)).rejects.toMatchObject({
      code: "video_asset_not_found",
    });
  });

  it("returns the configured playback URL with the requested lifetime", async () => {
    const source = await aProvider().createPlaybackToken("abc", { learnerId, ttlSeconds: 60 });

    expect(source).toEqual({
      type: "hls",
      url: "https://videos.example.com/abc.m3u8",
      expiresAt: new Date(now.getTime() + 60_000),
    });
  });

  it("accepts webhooks with the shared secret and updates the asset", async () => {
    const provider = aProvider();
    const body = { assetId: "abc", status: "ready", durationSeconds: 30, thumbnailUrl: null };

    const event = await provider.verifyWebhook(aWebhook(body));

    expect(event).toEqual(body);
    expect(provider.assets.get("abc")).toEqual(body);
  });

  it.each([
    ["another secret", { assetId: "abc", status: "ready" }, "wrong"],
    ["a body that is not JSON", "not json", "fake-secret"],
    ["an unknown status", { assetId: "abc", status: "gone" }, "fake-secret"],
    ["no asset id", { status: "ready" }, "fake-secret"],
    ["a JSON scalar", 42, "fake-secret"],
  ])("rejects a webhook with %s", async (_name, body, secret) => {
    expect(await aProvider().verifyWebhook(aWebhook(body, secret))).toBeNull();
  });

  it("keeps a thumbnail and treats a missing duration as unknown", async () => {
    const body = {
      assetId: "abc",
      status: "processing",
      thumbnailUrl: "https://example.com/t.jpg",
    };

    expect(await aProvider().verifyWebhook(aWebhook(body))).toEqual({
      ...body,
      durationSeconds: null,
    });
  });

  it("uses the system clock when none is injected", async () => {
    const provider = fakeVideoProvider({
      playbackUrl: () => "https://example.com/v.m3u8",
      webhookSecret: "s",
    });

    const source = await provider.createPlaybackToken("abc", { learnerId, ttlSeconds: 60 });

    expect(source.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("lets tests finish processing an asset", async () => {
    const provider = aProvider();

    provider.setAsset("abc", { status: "ready", durationSeconds: 12, thumbnailUrl: null });

    expect(await provider.getAsset("abc")).toMatchObject({ status: "ready", durationSeconds: 12 });
  });
});

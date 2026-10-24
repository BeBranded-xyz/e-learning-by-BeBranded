import { describe, expect, it } from "vitest";

import { learnerIdSchema } from "@bebranded/elearning-core";

import { stubFetch } from "../../tests/fixtures/fetch.js";
import { aSigningKey, decodeJwt, signWebhook } from "../../tests/fixtures/keys.js";
import {
  ACCOUNT_ID,
  SIGNING_KEY_ID,
  VIDEO_UID,
  WEBHOOK_SECRET,
  directUploadResult,
  envelope,
  readyVideo,
} from "../../tests/fixtures/stream.js";
import { cloudflareStream } from "./cloudflare-stream.js";
import type { CloudflareStreamOptions } from "./config.js";

const now = new Date("2026-10-23T09:00:00.000Z");
const learnerId = learnerIdSchema.parse("learner-1");

function options(overrides: Partial<CloudflareStreamOptions> = {}): CloudflareStreamOptions {
  return {
    accountId: ACCOUNT_ID,
    apiToken: "test-api-token-not-a-real-one",
    customerCode: "abc123",
    signingKey: { id: SIGNING_KEY_ID, jwk: "e30=" },
    webhookSecret: WEBHOOK_SECRET,
    now: () => now,
    ...overrides,
  };
}

describe("cloudflareStream", () => {
  it("creates a private direct upload with the maximum duration rounded up", async () => {
    const stub = stubFetch(envelope(directUploadResult));
    const provider = cloudflareStream(options({ fetch: stub.fetch }));

    const upload = await provider.createDirectUpload({ maxDurationSeconds: 599.5 });

    expect(upload).toEqual({
      uploadUrl: directUploadResult.uploadURL,
      assetId: VIDEO_UID,
      protocol: "form",
    });
    expect(JSON.parse(stub.calls[0]?.init.body as string)).toEqual({
      maxDurationSeconds: 600,
      requireSignedURLs: true,
    });
    expect(provider.name).toBe("cloudflare-stream");
  });

  it("rejects an upload answer whose URL is not https", async () => {
    const stub = stubFetch(
      envelope({ ...directUploadResult, uploadURL: "http://upload.example.com" }),
    );

    await expect(
      cloudflareStream(options({ fetch: stub.fetch })).createDirectUpload({
        maxDurationSeconds: 60,
      }),
    ).rejects.toThrow();
  });

  it("reads an asset's status, duration and thumbnail", async () => {
    const stub = stubFetch(envelope(readyVideo));

    const asset = await cloudflareStream(options({ fetch: stub.fetch })).getAsset(VIDEO_UID);

    expect(asset).toEqual({
      status: "ready",
      durationSeconds: 5.5,
      thumbnailUrl: readyVideo.thumbnail,
    });
    expect(stub.calls[0]?.url).toMatch(new RegExp(`/stream/${VIDEO_UID}$`));
  });

  it("deletes an asset", async () => {
    const stub = stubFetch(envelope(null));

    await cloudflareStream(options({ fetch: stub.fetch })).deleteAsset(VIDEO_UID);

    expect(stub.calls[0]?.init.method).toBe("DELETE");
  });

  it("refuses an asset id that could change the API path", async () => {
    const stub = stubFetch(envelope(readyVideo));
    const provider = cloudflareStream(options({ fetch: stub.fetch }));

    for (const assetId of ["../keys", "abc/def", "", "ABC"]) {
      await expect(provider.getAsset(assetId)).rejects.toMatchObject({
        code: "invalid_video_asset_id",
      });
    }
    expect(stub.calls).toEqual([]);
  });

  it("plays through a signed HLS URL on the customer subdomain, without calling the API", async () => {
    const { jwkBase64, publicKey } = await aSigningKey();
    const stub = stubFetch(envelope(null));
    const provider = cloudflareStream(
      options({ fetch: stub.fetch, signingKey: { id: SIGNING_KEY_ID, jwk: jwkBase64 } }),
    );

    const source = await provider.createPlaybackToken(VIDEO_UID, { learnerId, ttlSeconds: 900 });

    const match =
      /^https:\/\/customer-abc123\.cloudflarestream\.com\/([^/]+)\/manifest\/video\.m3u8$/.exec(
        source.url,
      );
    expect(match).not.toBeNull();
    expect((await decodeJwt(match?.[1] ?? "", publicKey)).valid).toBe(true);
    expect(source).toMatchObject({ type: "hls", expiresAt: new Date(now.getTime() + 900_000) });
    expect(stub.calls).toEqual([]);
  });

  it("verifies webhooks with the configured secret and clock", async () => {
    const body = JSON.stringify(readyVideo);
    const request = new Request("https://host.example.com/webhook", {
      method: "POST",
      headers: {
        "webhook-signature": await signWebhook(WEBHOOK_SECRET, now.getTime() / 1000, body),
      },
      body,
    });

    expect(await cloudflareStream(options()).verifyWebhook(request)).toMatchObject({
      assetId: VIDEO_UID,
      status: "ready",
    });
  });

  it("signs with the system clock when none is injected", async () => {
    const { jwkBase64 } = await aSigningKey();
    const withoutClock = options({ signingKey: { id: SIGNING_KEY_ID, jwk: jwkBase64 } });
    delete withoutClock.now;
    const before = Date.now();

    const source = await cloudflareStream(withoutClock).createPlaybackToken(VIDEO_UID, {
      learnerId,
      ttlSeconds: 60,
    });

    expect(source.expiresAt.getTime()).toBeGreaterThanOrEqual(
      Math.floor(before / 1000) * 1000 + 60_000,
    );
    expect(source.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 61_000);
  });

  it.each([
    ["an account id that is not 32 hex characters", { accountId: "my-account" }],
    ["a short API token", { apiToken: "short" }],
    ["a customer code with a dot", { customerCode: "evil.example.com" }],
    ["a short webhook secret", { webhookSecret: "short" }],
    ["a webhook tolerance over an hour", { webhookToleranceSeconds: 7200 }],
  ])("refuses %s at startup", (_name, overrides) => {
    expect(() => cloudflareStream(options(overrides))).toThrow();
  });
});

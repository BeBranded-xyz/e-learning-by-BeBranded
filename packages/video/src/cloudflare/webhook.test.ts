import { describe, expect, it } from "vitest";

import { signWebhook } from "../../tests/fixtures/keys.js";
import {
  VIDEO_UID,
  WEBHOOK_SECRET,
  erroredVideo,
  readyVideo,
} from "../../tests/fixtures/stream.js";
import { MAX_WEBHOOK_BYTES, parseSignatureHeader, verifyStreamWebhook } from "./webhook.js";

const now = new Date("2026-10-23T09:00:00.000Z");
const time = now.getTime() / 1000;
const options = { secret: WEBHOOK_SECRET, now, toleranceSeconds: 300 };

function aWebhook(body: string, signature: string | null, headers: Record<string, string> = {}) {
  return new Request("https://host.example.com/api/elearning/v1/webhooks/video", {
    method: "POST",
    headers: { ...(signature === null ? {} : { "webhook-signature": signature }), ...headers },
    body,
  });
}

async function signed(body: unknown, at = time, secret = WEBHOOK_SECRET) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return aWebhook(text, await signWebhook(secret, at, text));
}

describe("verifyStreamWebhook", () => {
  it("returns the asset snapshot of a correctly signed ready webhook", async () => {
    const event = await verifyStreamWebhook(await signed(readyVideo), options);

    expect(event).toEqual({
      assetId: VIDEO_UID,
      status: "ready",
      durationSeconds: 5.5,
      thumbnailUrl: readyVideo.thumbnail,
    });
  });

  it("returns an error snapshot for the documented error webhook", async () => {
    expect(await verifyStreamWebhook(await signed(erroredVideo), options)).toMatchObject({
      status: "error",
    });
  });

  it("accepts a timestamp at the edge of the tolerance", async () => {
    expect(await verifyStreamWebhook(await signed(readyVideo, time - 300), options)).not.toBeNull();
  });

  it.each([
    ["older than the tolerance (replay)", time - 301],
    ["too far in the future", time + 301],
  ])("rejects a webhook %s", async (_name, at) => {
    expect(await verifyStreamWebhook(await signed(readyVideo, at), options)).toBeNull();
  });

  it("rejects a webhook signed with another secret", async () => {
    const request = await signed(readyVideo, time, "another-secret-entirely");

    expect(await verifyStreamWebhook(request, options)).toBeNull();
  });

  it("rejects a body changed after signing", async () => {
    const body = JSON.stringify(readyVideo);
    const signature = await signWebhook(WEBHOOK_SECRET, time, body);
    const tampered = body.replace('"duration":5.5', '"duration":9999');

    expect(await verifyStreamWebhook(aWebhook(tampered, signature), options)).toBeNull();
  });

  it("rejects a signature replayed with another timestamp", async () => {
    const body = JSON.stringify(readyVideo);
    const signature = (await signWebhook(WEBHOOK_SECRET, time - 3600, body)).replace(
      `time=${time - 3600}`,
      `time=${time}`,
    );

    expect(await verifyStreamWebhook(aWebhook(body, signature), options)).toBeNull();
  });

  it("rejects a missing signature header", async () => {
    expect(await verifyStreamWebhook(aWebhook("{}", null), options)).toBeNull();
  });

  it("rejects a body over the size limit, even when signed", async () => {
    const huge = JSON.stringify({
      ...readyVideo,
      meta: { padding: "x".repeat(MAX_WEBHOOK_BYTES) },
    });

    expect(await verifyStreamWebhook(await signed(huge), options)).toBeNull();
  });

  it("rejects a declared content length over the limit without reading the body", async () => {
    const request = aWebhook("{}", "time=1,sig1=" + "0".repeat(64), {
      "content-length": String(MAX_WEBHOOK_BYTES + 1),
    });
    const signature = await signWebhook(WEBHOOK_SECRET, time, "{}");
    request.headers.set("webhook-signature", signature);

    expect(await verifyStreamWebhook(request, options)).toBeNull();
    expect(request.bodyUsed).toBe(false);
  });

  it.each([
    ["a signed body that is not JSON", "not json"],
    ["a signed body that is not a video", JSON.stringify({ hello: "world" })],
  ])("rejects %s", async (_name, body) => {
    expect(await verifyStreamWebhook(await signed(body), options)).toBeNull();
  });
});

describe("parseSignatureHeader", () => {
  it("reads the time and the hex signature, in any order and with spaces", () => {
    const sig = "ab".repeat(32);

    expect(parseSignatureHeader(`sig1=${sig}, time=1230811200`)).toEqual({
      time: 1230811200,
      signature: new Uint8Array(32).fill(0xab),
    });
  });

  it.each([
    ["no time", `sig1=${"ab".repeat(32)}`],
    ["no signature", "time=1230811200"],
    ["a non-numeric time", `time=abc,sig1=${"ab".repeat(32)}`],
    ["a short signature", "time=1,sig1=abcd"],
    ["an uppercase signature", `time=1,sig1=${"AB".repeat(32)}`],
    ["garbage", "garbage"],
  ])("rejects a header with %s", (_name, header) => {
    expect(parseSignatureHeader(header)).toBeNull();
  });
});

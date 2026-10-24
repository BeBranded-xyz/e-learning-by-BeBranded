import { describe, expect, it } from "vitest";

import { stubFetch } from "../../tests/fixtures/fetch.js";
import {
  ACCOUNT_ID,
  SIGNING_KEY_ID,
  VIDEO_UID,
  WEBHOOK_SECRET,
  directUploadResult,
  envelope,
} from "../../tests/fixtures/stream.js";
import { cloudflareStream } from "./cloudflare-stream.js";
import type { CloudflareStreamOptions } from "./config.js";
import { BASIC_UPLOAD_MAX_BYTES } from "./tus.js";

const TUS_URL = "https://upload.videodelivery.net/tus/ea95132c15732412d22c1476fa83f27a?tusv2=true";

type Call = { url: Parameters<typeof fetch>[0]; init: RequestInit };

/** A fetch double answering Stream's tus creation with the given status and headers. */
function tusFetch(status: number, headers: Record<string, string>) {
  const calls: Call[] = [];
  const fetchStub: typeof fetch = (input, init) => {
    calls.push({ url: input, init: init ?? {} });
    return Promise.resolve(new Response(null, { status, headers }));
  };
  return { fetch: fetchStub, calls };
}

function provider(fetchStub: typeof fetch) {
  const options: CloudflareStreamOptions = {
    accountId: ACCOUNT_ID,
    apiToken: "test-api-token-not-a-real-one",
    customerCode: "abc123",
    signingKey: { id: SIGNING_KEY_ID, jwk: "e30=" },
    webhookSecret: WEBHOOK_SECRET,
    fetch: fetchStub,
  };
  return cloudflareStream(options);
}

const large = BASIC_UPLOAD_MAX_BYTES + 1;

describe("resumable (tus) uploads", () => {
  it("creates a private tus upload for a file over 200 MB", async () => {
    const stub = tusFetch(201, { location: TUS_URL, "stream-media-id": VIDEO_UID });

    const upload = await provider(stub.fetch).createDirectUpload({
      maxDurationSeconds: 599.5,
      sizeBytes: large,
    });

    expect(upload).toEqual({ uploadUrl: TUS_URL, assetId: VIDEO_UID, protocol: "tus" });
    const call = stub.calls[0];
    expect(call?.url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream?direct_user=true`,
    );
    expect(call?.init.method).toBe("POST");
    expect(call?.init.headers).toMatchObject({
      authorization: "Bearer test-api-token-not-a-real-one",
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(large),
      // "600" in base64, and the flag that makes the video private.
      "Upload-Metadata": "maxdurationseconds NjAw,requiresignedurls",
    });
    expect(call?.init.body).toBeUndefined();
  });

  it("keeps the basic upload at exactly 200 MB and without a size", async () => {
    const stub = stubFetch(envelope(directUploadResult));
    const stream = provider(stub.fetch);

    expect(
      (
        await stream.createDirectUpload({
          maxDurationSeconds: 60,
          sizeBytes: BASIC_UPLOAD_MAX_BYTES,
        })
      ).protocol,
    ).toBe("form");
    expect((await stream.createDirectUpload({ maxDurationSeconds: 60 })).protocol).toBe("form");
  });

  it.each([
    ["an error status", 400, { location: TUS_URL, "stream-media-id": VIDEO_UID }],
    ["no Location", 201, { "stream-media-id": VIDEO_UID }],
    [
      "an http Location",
      201,
      { location: "http://upload.example.com/x", "stream-media-id": VIDEO_UID },
    ],
    ["no media id", 201, { location: TUS_URL }],
    ["a malformed media id", 201, { location: TUS_URL, "stream-media-id": "../x" }],
  ])("fails as an upstream error on %s", async (_label, status, headers) => {
    const stub = tusFetch(status, headers);

    await expect(
      provider(stub.fetch).createDirectUpload({ maxDurationSeconds: 60, sizeBytes: large }),
    ).rejects.toMatchObject({ kind: "upstream", code: "video_provider_error" });
  });
});

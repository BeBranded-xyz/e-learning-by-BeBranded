import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_ID, envelope } from "../../tests/fixtures/stream.js";
import { failingFetch, stubFetch } from "../../tests/fixtures/fetch.js";
import { streamApi } from "./api.js";
import { cloudflareStreamOptionsSchema } from "./config.js";

const TOKEN = "test-api-token-not-a-real-one";

function aConfig(fetchImpl: typeof fetch) {
  return cloudflareStreamOptionsSchema.parse({
    accountId: ACCOUNT_ID,
    apiToken: TOKEN,
    customerCode: "test",
    signingKey: { id: "fedcba9876543210fedcba9876543210", jwk: "e30=" },
    webhookSecret: "test-webhook-secret-not-real",
    fetch: fetchImpl,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamApi", () => {
  it("uses the global fetch when none is injected", async () => {
    const stub = stubFetch(envelope({ uid: "abc" }));
    vi.stubGlobal("fetch", stub.fetch);
    const config = aConfig(stub.fetch);
    delete config.fetch;

    expect(await streamApi(config, { method: "GET", path: "/abc" })).toEqual({ uid: "abc" });
    expect(stub.calls).toHaveLength(1);
  });

  it("calls the account's Stream API with the bearer token and returns the result", async () => {
    const stub = stubFetch(envelope({ uid: "abc" }));

    const result = await streamApi(aConfig(stub.fetch), {
      method: "POST",
      path: "/direct_upload",
      body: { maxDurationSeconds: 60 },
    });

    expect(result).toEqual({ uid: "abc" });
    expect(stub.calls[0]?.url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/direct_upload`,
    );
    expect(stub.calls[0]?.init.method).toBe("POST");
    expect(stub.calls[0]?.init.headers).toEqual({
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    });
    expect(stub.calls[0]?.init.body).toBe('{"maxDurationSeconds":60}');
    expect(stub.calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends no body and no content type on a GET", async () => {
    const stub = stubFetch(envelope({}));

    await streamApi(aConfig(stub.fetch), { method: "GET", path: "/abc" });

    expect(stub.calls[0]?.init.headers).toEqual({ authorization: `Bearer ${TOKEN}` });
    expect(stub.calls[0]?.init.body).toBeUndefined();
  });

  it.each([
    ["a 404", stubFetch(envelope(null, false), 404), "video_asset_not_found"],
    ["a 500", stubFetch(envelope(null, false), 500), "video_provider_error"],
    ["success: false with a 200", stubFetch(envelope(null, false)), "video_provider_error"],
    ["a body that is not JSON", stubFetch("<html>bad gateway</html>", 502), "video_provider_error"],
    ["a body without an envelope", stubFetch({ hello: "world" }), "video_provider_error"],
  ])("turns %s into an upstream error", async (_name, stub, code) => {
    await expect(
      streamApi(aConfig(stub.fetch), { method: "GET", path: "/abc" }),
    ).rejects.toMatchObject({ kind: "upstream", code });
  });

  it("reports a timeout as video_provider_timeout", async () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");

    await expect(
      streamApi(aConfig(failingFetch(timeout)), { method: "GET", path: "" }),
    ).rejects.toMatchObject({ kind: "upstream", code: "video_provider_timeout" });
  });

  it("reports a network failure as video_provider_unavailable", async () => {
    await expect(
      streamApi(aConfig(failingFetch(new TypeError("fetch failed"))), { method: "GET", path: "" }),
    ).rejects.toMatchObject({ kind: "upstream", code: "video_provider_unavailable" });
  });

  it("never puts the API token in an error message", async () => {
    const stub = stubFetch(envelope(null, false), 403);

    const error: unknown = await streamApi(aConfig(stub.fetch), { method: "GET", path: "" }).catch(
      (caught: unknown) => caught,
    );

    expect((error as Error).message).not.toContain(TOKEN);
    expect((error as Error).message).toBe("Cloudflare Stream answered 403 to GET /.");
  });
});

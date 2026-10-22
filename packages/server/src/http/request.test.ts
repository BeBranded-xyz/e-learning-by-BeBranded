import { describe, expect, it } from "vitest";

import { assertAllowedOrigin, readJsonBody } from "./request.js";

const post = (headers: Record<string, string>, body?: string) =>
  new Request("https://h.example.com/api/elearning/v1/x", {
    method: "POST",
    headers,
    body: body ?? null,
  });

describe("readJsonBody", () => {
  it("parses a JSON body", async () => {
    expect(
      await readJsonBody(
        post({ "content-type": "application/json; charset=utf-8" }, '{"a":1}'),
        100,
      ),
    ).toEqual({ a: 1 });
  });

  it.each([
    ["a missing content type", {}],
    ["form data", { "content-type": "application/x-www-form-urlencoded" }],
    ["a look-alike type", { "content-type": "application/jsonp" }],
    ["text", { "content-type": "text/plain" }],
  ])("rejects %s with 415", async (_label, headers) => {
    await expect(readJsonBody(post(headers, "{}"), 100)).rejects.toMatchObject({
      code: "unsupported_media_type",
    });
  });

  it("rejects a declared length over the limit before reading", async () => {
    await expect(
      readJsonBody(
        post({ "content-type": "application/json", "content-length": "1000" }, "{}"),
        100,
      ),
    ).rejects.toMatchObject({
      code: "payload_too_large",
    });
  });

  it("rejects an actual body over the limit even when the declared length lies", async () => {
    await expect(
      readJsonBody(post({ "content-type": "application/json" }, `"${"x".repeat(200)}"`), 100),
    ).rejects.toMatchObject({
      code: "payload_too_large",
    });
  });

  it("rejects malformed JSON with 400", async () => {
    await expect(
      readJsonBody(post({ "content-type": "application/json" }, "{oops"), 100),
    ).rejects.toMatchObject({ code: "invalid_json" });
  });
});

describe("assertAllowedOrigin", () => {
  const request = (method: string, origin?: string) =>
    new Request("https://h.example.com/api/elearning/v1/x", {
      method,
      headers: origin === undefined ? {} : { origin },
    });
  const check = (method: string, origin?: string, allowed?: readonly string[]) => () => {
    assertAllowedOrigin(request(method, origin), allowed);
  };

  it.each(["POST", "PATCH", "DELETE"])("refuses a foreign origin on %s", (method) => {
    expect(check(method, "https://evil.example.net")).toThrow(
      expect.objectContaining({ code: "origin_not_allowed" }),
    );
  });

  it("accepts the request's own origin, a missing origin and any origin on GET", () => {
    expect(check("POST", "https://h.example.com")).not.toThrow();
    expect(check("POST")).not.toThrow();
    expect(check("GET", "https://evil.example.net")).not.toThrow();
  });

  it("uses the allowlist when one is configured", () => {
    const allowed = ["https://app.example.com"];

    expect(check("POST", "https://app.example.com", allowed)).not.toThrow();
    expect(check("POST", "https://h.example.com", allowed)).toThrow();
  });

  it("does not trust the null origin of sandboxed frames", () => {
    expect(check("POST", "null")).toThrow();
  });
});

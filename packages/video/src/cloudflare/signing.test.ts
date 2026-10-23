import { describe, expect, it } from "vitest";

import { aSigningKey, decodeJwt } from "../../tests/fixtures/keys.js";
import { SIGNING_KEY_ID, VIDEO_UID } from "../../tests/fixtures/stream.js";
import { MAX_TOKEN_TTL_SECONDS, importSigningKey, signPlaybackToken } from "./signing.js";

const config = { signingKey: { id: SIGNING_KEY_ID, jwk: "" } };
const issuedAt = new Date("2026-10-23T09:00:00.000Z");
const nowSeconds = issuedAt.getTime() / 1000;

describe("signPlaybackToken", () => {
  it("signs an RS256 JWT for the video with the key id, nbf and exp", async () => {
    const { jwkBase64, publicKey } = await aSigningKey();
    const key = await importSigningKey(jwkBase64);

    const { token, expiresAt } = await signPlaybackToken(config, key, {
      videoUid: VIDEO_UID,
      issuedAt,
      ttlSeconds: 600,
    });

    const decoded = await decodeJwt(token, publicKey);
    expect(decoded.valid).toBe(true);
    expect(decoded.header).toEqual({ alg: "RS256", kid: SIGNING_KEY_ID });
    expect(decoded.payload).toEqual({
      sub: VIDEO_UID,
      kid: SIGNING_KEY_ID,
      nbf: nowSeconds,
      exp: nowSeconds + 600,
    });
    expect(expiresAt).toEqual(new Date((nowSeconds + 600) * 1000));
    expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it.each([
    ["caps the lifetime at 24 hours", 10 * MAX_TOKEN_TTL_SECONDS, MAX_TOKEN_TTL_SECONDS],
    ["rounds a fractional lifetime up", 90.2, 91],
    ["keeps at least one second", 0, 1],
  ])("%s", async (_name, ttlSeconds, expected) => {
    const { jwkBase64, publicKey } = await aSigningKey();
    const key = await importSigningKey(jwkBase64);

    const { token } = await signPlaybackToken(config, key, {
      videoUid: VIDEO_UID,
      issuedAt,
      ttlSeconds,
    });

    const { payload } = await decodeJwt(token, publicKey);
    expect((payload as { exp: number }).exp - nowSeconds).toBe(expected);
  });
});

describe("importSigningKey", () => {
  it.each([
    ["not base64", "%%%"],
    ["base64 of something that is not JSON", btoa("not json")],
    ["a JWK that is not an RSA private key", btoa(JSON.stringify({ kty: "oct", k: "AAAA" }))],
  ])("rejects %s with invalid_signing_key", async (_name, jwk) => {
    await expect(importSigningKey(jwk)).rejects.toMatchObject({
      kind: "internal",
      code: "invalid_signing_key",
    });
  });
});

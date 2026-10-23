import { AppError } from "@bebranded/elearning-core";

import type { CloudflareStreamConfig } from "./config.js";

/** Cloudflare refuses tokens that expire more than 24 hours after signing. */
export const MAX_TOKEN_TTL_SECONDS = 24 * 60 * 60;

const ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

const encodeJson = (value: unknown) => base64Url(encoder.encode(JSON.stringify(value)));

/** Imports the base64 JWK of a Stream signing key, once per adapter. */
export async function importSigningKey(jwkBase64: string): Promise<CryptoKey> {
  try {
    const jwk = JSON.parse(atob(jwkBase64)) as JsonWebKey;
    return await crypto.subtle.importKey("jwk", jwk, ALGORITHM, false, ["sign"]);
  } catch (error) {
    throw new AppError("internal", "invalid_signing_key", "The Stream signing key is invalid.", {
      cause: error,
    });
  }
}

export type TokenClaims = {
  readonly videoUid: string;
  readonly issuedAt: Date;
  readonly ttlSeconds: number;
};

/**
 * A self-signed Stream playback token (RS256 JWT): `sub` is the video,
 * `nbf` and `exp` are Unix seconds, and the lifetime is capped at 24 hours.
 * See https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/.
 */
export async function signPlaybackToken(
  config: Pick<CloudflareStreamConfig, "signingKey">,
  key: CryptoKey,
  claims: TokenClaims,
): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(claims.issuedAt.getTime() / 1000);
  const exp = now + Math.min(Math.max(Math.ceil(claims.ttlSeconds), 1), MAX_TOKEN_TTL_SECONDS);
  const header = encodeJson({ alg: "RS256", kid: config.signingKey.id });
  const payload = encodeJson({ sub: claims.videoUid, kid: config.signingKey.id, nbf: now, exp });
  const signed = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(ALGORITHM, key, encoder.encode(signed));
  return {
    token: `${signed}.${base64Url(new Uint8Array(signature))}`,
    expiresAt: new Date(exp * 1000),
  };
}

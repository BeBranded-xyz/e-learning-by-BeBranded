const ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

/** A throwaway RSA key pair, exported like a Stream signing key (base64 JWK). */
export async function aSigningKey() {
  const pair = await crypto.subtle.generateKey(
    { ...ALGORITHM, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { jwkBase64: btoa(JSON.stringify(jwk)), publicKey: pair.publicKey };
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Splits a JWT, checks its RS256 signature, and returns its decoded parts. */
export async function decodeJwt(token: string, publicKey: CryptoKey) {
  const [header = "", payload = "", signature = ""] = token.split(".");
  const valid = await crypto.subtle.verify(
    ALGORITHM,
    publicKey,
    fromBase64Url(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const decode = (part: string): unknown =>
    JSON.parse(new TextDecoder().decode(fromBase64Url(part)));
  return { valid, header: decode(header), payload: decode(payload) };
}

/** Signs a webhook body the way Stream does: hex HMAC-SHA256 of `<time>.<body>`. */
export async function signWebhook(secret: string, time: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${time}.${body}`));
  const hex = Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `time=${time},sig1=${hex}`;
}

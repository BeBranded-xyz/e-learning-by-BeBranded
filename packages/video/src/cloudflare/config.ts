import { z } from "zod";

/**
 * Options of the Cloudflare Stream adapter, validated once at startup
 * (core/code-standards, "Configuration"). Secrets come from the host's
 * validated environment; this package never reads `process.env`.
 */
export const cloudflareStreamOptionsSchema = z.strictObject({
  accountId: z.string().regex(/^[0-9a-f]{32}$/, "Expected a Cloudflare account id"),
  /** API token with the Stream Write permission. */
  apiToken: z.string().min(20),
  /** The `customer-<CODE>.cloudflarestream.com` code of the account. */
  customerCode: z.string().regex(/^[a-z0-9]{1,64}$/, "Expected the customer subdomain code"),
  /** A Stream signing key: `id` and the base64 `jwk` returned when the key was created. */
  signingKey: z.strictObject({
    id: z.string().regex(/^[0-9a-f]{32}$/, "Expected a signing key id"),
    jwk: z.string().min(1),
  }),
  /** The `secret` returned when the webhook was registered. */
  webhookSecret: z.string().min(16),
  /** Oldest webhook accepted, in seconds; older ones are treated as replays. */
  webhookToleranceSeconds: z.int().min(30).max(3600).default(300),
  /** Deadline of every API call. */
  timeoutMs: z.int().min(100).max(60_000).default(10_000),
  /** Injected for tests; defaults to the global `fetch`. */
  fetch: z.custom<typeof fetch>((value) => typeof value === "function").optional(),
  /** Injected for tests; defaults to the system clock. */
  now: z.custom<() => Date>((value) => typeof value === "function").optional(),
});

export type CloudflareStreamOptions = z.input<typeof cloudflareStreamOptionsSchema>;
export type CloudflareStreamConfig = z.output<typeof cloudflareStreamOptionsSchema>;

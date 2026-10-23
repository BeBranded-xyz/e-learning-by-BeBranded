# @bebranded/elearning-video

Video provider adapters of the BeBranded e-learning module. Server-only. MIT licensed.

## Cloudflare Stream

```ts
import { cloudflareStream } from "@bebranded/elearning-video";

// Values come from the host's validated environment, never from source code.
export const video = cloudflareStream({
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: env.CLOUDFLARE_STREAM_API_TOKEN, // Stream Write permission
  customerCode: env.CLOUDFLARE_STREAM_CUSTOMER_CODE, // customer-<CODE>.cloudflarestream.com
  signingKey: { id: env.CLOUDFLARE_STREAM_KEY_ID, jwk: env.CLOUDFLARE_STREAM_KEY_JWK },
  webhookSecret: env.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
});
```

- Uploads are direct creator uploads (one `multipart/form-data` POST from the browser, up to
  200 MB) created with `requireSignedURLs`, so videos are private.
- Playback uses self-signed RS256 tokens (the signing key from `POST /stream/keys`), valid at
  most 24 hours. No API call per playback.
- Webhooks are verified with HMAC-SHA256 of `<time>.<body>` and refused when older than
  `webhookToleranceSeconds` (default 300).
- Every API call has a timeout (`timeoutMs`, default 10 s) and fails with an `upstream` error
  (`video_provider_timeout`, `video_provider_unavailable`, `video_provider_error`,
  `video_asset_not_found`).

## Testing

`@bebranded/elearning-video/testing` exports `fakeVideoProvider`, an in-memory provider for
tests and demos. Its playback URLs are not signed: never use it in production.

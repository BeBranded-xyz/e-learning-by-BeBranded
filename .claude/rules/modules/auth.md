---
description: Authentication & session management patterns. Generic. Apply when the project has user auth.
paths:
  - "**/auth/**"
  - "**/middleware.ts"
---

# Authentication

Apply when `PROJECT.md` declares an auth system. The chosen library, protected
routes, customer types, and signup side-effects are project-specific — see
`PROJECT.md`.

## Principles

- **Use a vetted auth library; never roll your own.** If it lacks a feature you
  need, document the gap and prefer a plugin or upstream PR over a custom system.
- **One auth system per project.** Don't mix two session models.
- **Keep auth portable**: isolate it behind your own helpers so the rest of the
  codebase depends on `getSession()` / `useSession()`, not on the vendor SDK
  directly. This makes the provider swappable.

## Reading the session

- **Server side** (server components / handlers / actions): read the session
  through a single server helper. Cache it per request to dedupe. Never read auth
  cookies directly.
- **Client side**: read through the auth library's client, wrapped in one custom
  hook — never via raw `fetch`.
- **Never pass the full session object to client components**; pass only the
  fields the client needs (id, display name).
- **Never log the session object** — it may contain PII.

```ts
// server helper — cache per request
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
```

## Route protection

Protect private routes in middleware (or the framework equivalent), redirecting
unauthenticated users to the login page with a return path. Keep the protected
path list in one place and keep it in sync with the matcher.

```ts
const PROTECTED = ["/account", "/checkout"]; // see PROJECT.md for the real list
```

Double-check that confirmation / receipt pages are protected — an unauthenticated
user must not be able to view another user's data by URL.

## Cross-runtime auth (functions / different runtimes)

A function running in a different runtime usually cannot call the auth library
directly. Instead:

1. The trusted server mints a **signed, short-lived token** and passes it in an
   `Authorization: Bearer` header.
2. The function **verifies the token** against a shared secret, extracts the user
   id, and uses a privileged DB client for the work.

**Never forward raw session cookies across runtimes.** Always use a signed token.

## Signup / multi-step flows

When signup has side-effects (create profile row, sync to CRM, add to mailing
list, send welcome email), separate **critical** from **best-effort** steps:

- **Critical steps must be atomic** from the user's view: if creating the local
  profile fails, roll back the auth user.
- **Best-effort steps** (third-party sync, marketing list, email) must never fail
  the signup. Capture failures in the error tracker and continue; the user can
  retry from their profile.
- **Never block signup/login on a third party being reachable.** Run those
  asynchronously.

## Anonymous → authenticated continuity

If anonymous users accumulate state (a cart, a draft), merge it into their
account **on both signup and login**. Use the privileged client for the
cross-identity update and log the merge for traceability.

## Validation

Validate auth inputs with a schema (signup, login, profile, password reset).
For conditional fields (e.g. a company id required only for business accounts),
use a discriminated union so invalid combinations can't typecheck or submit.

## Security

- HttpOnly cookies for tokens; never `localStorage`. HTTPS-only in production.
- Enforce a sane minimum password length both in the schema and in the auth config.
- Rate-limit signup and login (e.g. a few attempts per IP per window).
- Require email verification before sensitive actions if the project needs it.
- Never log passwords, tokens, or sessions; scrub before sending anywhere.
- Cascade deletes so deleting an auth user doesn't orphan the profile row.

## Email sending

If the project has its own email provider, override the auth library's default
sender so all emails (verification, password reset) go through it for consistent
branding, tracking, and unsubscribe handling.

## Testing

Auth is a maximal-testing area (`testing.mdc`, row "Auth / session / permissions"):
- **Authentication suite**: signup, login, logout, wrong password, locked
  account, expired session, refresh, password reset token single-use and
  expiry, email verification, rate limiting (N+1 attempts are rejected).
- **Authorization suite**: every protected route and action tested as
  unauthenticated, as the owner, and as another authenticated user; IDOR on
  every id-bearing URL; role escalation attempts.
- **Signup side-effects**: critical step failure rolls back the auth user;
  best-effort step failure still completes signup; anonymous state merges on
  signup and on login.
- **Cross-runtime tokens**: expired, wrong signature, wrong audience, replayed.
- **Cookies**: HttpOnly, Secure, SameSite asserted in an integration test.
- **Schema fuzzing** of every auth input; only validation errors result.
- **E2E**: the full login, signup, reset, and logout journeys on desktop and
  mobile viewports; no PII in logs asserted with a log capture.

## Checklist when touching auth code
- [ ] Session read through the shared helper; cached server-side
- [ ] No PII logged (password, token, email)
- [ ] Middleware protects every required route (including confirmation pages)
- [ ] Critical signup steps roll back on failure; side-effects are non-blocking
- [ ] Anonymous state merged on signup AND login
- [ ] Inputs validated with a schema
- [ ] Rate limiting in place
- [ ] `.env.example` updated for new variables
- [ ] Tests cover happy path AND failure paths

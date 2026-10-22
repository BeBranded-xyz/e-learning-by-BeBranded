---
name: new-function
description: Scaffold a serverless function, API route, server action, webhook handler, or job following modules/integrations.mdc, modules/api-design.mdc, and core/error-handling.mdc - thin entry, typed handler, data access file, README, registry entry, env vars, and the full test set (API, contract, fuzz, auth, error envelope, idempotency). Use whenever a new backend entry point is added.
---

# /new-function <name> [--kind client|service|webhook|internal|job]

## Steps

1. Read `PROJECT.md` (runtime, functions directory, auth model) and the
   rules: `modules/integrations.mdc`, `modules/api-design.mdc`,
   `core/error-handling.mdc`, plus the platform rule (Supabase Edge
   Functions, Cloudflare Workers, Next.js route handlers / server actions).
2. Confirm the function does not already exist (`FUNCTIONS_REGISTRY.md`,
   code search). Extend instead of duplicating.
3. Create the structure:
   ```
   <dir>/<name>/
     index.*          entry: parse, validate (schema), respond; CORS if client-facing
     handler.*        business logic; typed input -> typed output; no HTTP
     queries.*        data access only
     <name>.types.*   request/response types inferred from schemas
     <name>.schema.*  input/output schemas
     README.md        purpose, auth, inputs, outputs, error codes, how to run/test
   ```
4. Auth per kind: client -> request auth + RLS; service -> signed short-lived
   token; webhook -> signature verification before parsing the body;
   internal -> not externally reachable + defensive secret; job -> idempotency
   key and timeout (`modules/background-jobs.mdc`).
5. Entry point: top-level try/catch mapping error class to status
   (`core/error-handling.mdc`), single error envelope with `code` and
   `request_id`, no stack traces to the client, init the error tracker and
   open a request span (`modules/observability.mdc`).
6. Third-party calls go through the shared typed wrapper in `_shared/`;
   create it if missing, with recorded fixtures.
7. Env vars: add each to `.env.example` with a description; read them once
   at init and fail fast when missing.
8. Tests, all of them (`core/testing.mdc` row "API route / server action /
   function"):
   - unit tests for the handler (happy, edge, error paths)
   - API tests: happy, validation 400, unauthenticated 401, forbidden 403,
     not found 404, conflict 409, rate limit 429 if applicable
   - contract test: response validates against the schema; error codes match
     the README
   - fuzz of the input schema (malformed JSON, wrong types, huge payloads,
     unicode); assert only 4xx result
   - webhook: valid signature, invalid signature, replayed event, out-of-order
     event
   - job: run twice (idempotent), retry then success, timeout, two workers
   - error-envelope test: no internal detail leaks on a forced 500
9. Add the row to `FUNCTIONS_REGISTRY.md` and the OpenAPI spec if the project
   has one (generated from the schemas, never hand-written).
10. Run `/check`. Report which steps ran.

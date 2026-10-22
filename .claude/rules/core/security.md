---
description: Security and privacy baseline — secrets, authorization, input validation, data protection. Project-agnostic.
---

# Security & Privacy

Applies to every project. Concrete keys, roles, regions, and which data is
personal live in `PROJECT.md`.

## Secrets

- **No secrets in code. Ever.** All secrets live in environment variables or a
  secret manager.
- **Never expose server-only credentials to the client.** Public/client-exposed
  variables (e.g. `NEXT_PUBLIC_*`) must never hold a secret.
- **Keep `.env.local` (and equivalents) in `.gitignore`.** Maintain a committed
  `.env.example` listing every required variable name with a description and no
  values.
- **Rotate secrets** on a schedule (e.g. every 6 months) and immediately after any
  suspected leak. If a secret ever reaches the client, treat it as leaked.
- **Never log secrets**, even in debug mode.

## Authorization & data access

- **Enforce authorization at the data layer**, not only in the UI. If the database
  supports row-level security (RLS) or equivalent, enable it on every table with at
  least one explicit policy; default to deny.
- **Never disable row-level security to "test" or "debug".** Use a dedicated
  privileged/server-side client for legitimate elevated operations, and document
  why each such use exists with a code comment.
- **Privileged credentials are server-only.** They never reach the browser or any
  client bundle. Enforce with a lint rule that blocks importing server-only modules
  from client code where possible.
- **Verify users cannot access other users' data.** Test each policy against an
  unauthenticated user, the owner, and a different authenticated user.
- **Never expose privileged query results directly to a client** without filtering —
  they may include rows the caller is not allowed to see.

## Input validation & sanitization

- **Validate ALL external inputs server-side** with a schema (API routes,
  functions, webhooks, form submissions). Re-validate on the server even if the
  client already validated.
- **Never build SQL or shell strings by concatenation.** Use parameterized
  queries / query builders / safe argument passing.
- **Never render untrusted HTML** unless sanitized with a trusted library.
- **Escape user input in logs** to avoid log injection.
- **Validate uploads**: check MIME type, size, and extension; isolate stored
  objects per user (path/prefix), and serve via short-lived signed URLs rather than
  public links.

## Webhooks & service-to-service

- **Verify the authenticity of every inbound webhook** (signature/HMAC or shared
  secret) before processing any payload. A failed verification is a high-severity
  event.
- **Service-to-service calls** use signed, short-lived tokens or a shared secret —
  never unauthenticated access, never raw session cookies forwarded across runtimes.

## Authentication

- **Use a vetted auth library.** Never roll a custom auth system. If a needed
  feature is missing, document the gap and prefer a plugin/PR upstream.
- **Session tokens in HttpOnly cookies**, not `localStorage`. HTTPS-only in
  production.
- **Rate-limit** signup/login and other abuse-prone endpoints.
- **Never log** passwords, tokens, or full session objects. Scrub before sending
  anywhere.

## Security testing

Security is tested, not assumed (`testing.mdc`, "Security testing is part of
testing"). Every project runs at the stated gates:
- **Commit**: secret scanning (gitleaks or equivalent), dependency audit.
- **PR**: SAST (CodeQL, semgrep, or the language tool), license scan,
  container and IaC scans, authorization suite (every role against every
  resource, IDOR, escalation), input fuzzing of changed boundaries, security
  headers test, upload validation tests.
- **Pre-production**: DAST (ZAP baseline or equivalent) against the deployed
  candidate, authentication suite, injection suite (SQL, NoSQL, command, XSS,
  SSRF, path traversal, template), webhook signature suite, rate-limit tests.
- **Before a major launch and yearly**: human penetration test; findings
  become regression tests.
- Any high or critical finding blocks the gate. Suppressions require a linked
  issue and an expiry date.

## Privacy / data protection

- **Data minimization**: collect only what is necessary.
- **Right to access / delete**: give users a way to view, edit, and delete their
  personal data.
- **Hosting region & retention** follow the project's compliance needs — see
  `PROJECT.md`.
- **No raw PII in error trackers or logs** — see `observability.mdc`.
- **Marketing email** must include an unsubscribe path.

## Lifecycle and audit modules

- Activate `modules/data-lifecycle.mdc` when storing persistent user or business
  data; document retention, deletion propagation, and restore behavior.
- Activate `modules/audit-trail.mdc` for sensitive administrative, permission,
  or business operations. Operational logs do not replace an audit trail.

## Checklist when touching security-relevant code
- [ ] No secret in code, config, logs, or client bundles; `.env.example` updated
- [ ] Authorization enforced at the data layer (RLS or equivalent), default deny
- [ ] Privileged client server-only, each use documented
- [ ] Every external input validated server-side with a schema; no string-built SQL or shell
- [ ] Untrusted HTML sanitized; uploads validated and served via signed URLs
- [ ] Inbound webhooks signature-verified; service-to-service calls use signed short-lived tokens
- [ ] Sessions in HttpOnly cookies; abuse-prone endpoints rate-limited
- [ ] No PII in logs or the error tracker; data minimization respected
- [ ] Security suites (authz, injection, fuzz, SAST, dependency scan) cover the change

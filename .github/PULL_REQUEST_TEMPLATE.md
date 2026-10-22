<!-- Title: type(scope): imperative description (conventional commit style) -->

## What

<!-- One paragraph. What changes and why. Link the issue: Fixes #123 -->

## How to test

<!-- Numbered steps a reviewer can follow. Include commands and URLs. -->

1.
2.

## Tests added or updated

<!-- Per core/testing.mdc "what every change must add". List the categories. -->

- [ ] Unit (happy, edge, boundary, negative, error)
- [ ] Property-based / fuzz (where inputs form a domain or cross a boundary)
- [ ] Component + accessibility + visual regression (UI changes)
- [ ] API / contract / error-envelope (endpoints, actions, functions)
- [ ] Database: migration up + down, RLS (anon / owner / other), constraints
- [ ] Integration / webhook: fixtures, signature, retry, timeout, idempotency
- [ ] Job: idempotency, retry, concurrency, dead-letter
- [ ] Auth / authorization per role and resource
- [ ] E2E journey on desktop and mobile viewport
- [ ] Performance benchmark / load scenario (performance-sensitive paths)
- [ ] Regression test for a bug fix (written before the fix)
- [ ] `TEST_PLAN.md` updated (new tooling, commands, or status)
- [ ] Every further test the change allows was added; the rest is in `BACKLOG.md`

## Verification run locally

<!-- Paste the exact commands you ran and their result. Do not tick what you did not run. -->

- [ ] Check command green: `...`
- [ ] PR-gate suites run locally where possible: `...`
- [ ] Not run (and why): ...

## Documentation

- [ ] Feature docs created/updated: [list files]
- [ ] README.md updated (if structure/config/env changed)
- [ ] `.env.example` + deployment docs updated (if env var added)
- [ ] Migration changelog updated (if a DB migration is included)
- [ ] Function/endpoint docs + registry updated (if added/changed/removed)
- [ ] `PROJECT.md` updated (if stack/structure/decision changed)
- [ ] ADR added (if an architecture decision was made)
- [ ] `BACKLOG.md` updated (done items closed, discoveries and deferred scope added)
- [ ] No documentation needed (explain: ___)

## Risk and rollout

- **Breaking changes**:
- **Migration / rollout steps** (expand/contract, flags, canary):
- **Rollback plan**:
- **Feature flag** (name, default, removal date):

## Screenshots / recordings

<!-- Mandatory for UI changes: before and after, desktop and mobile. -->

## Self-review

- [ ] Diff re-read end to end
- [ ] No file > 300 lines, no function > 50 lines (or documented exemption)
- [ ] No commented-out code, debug logging, unlinked TODO, suppressed diagnostic
- [ ] No secrets; no production data touched
- [ ] Public repository: no client names, internal identifiers or URLs, personal emails, or real personal data
- [ ] Clean room: I did not read, copy, or translate GPL, AGPL, or commercial source code for this change (`docs/specifications/10-editor-extensions.md`)
- [ ] Specifications in `docs/specifications/` updated if behavior changed
- [ ] Refactors in separate commits from features

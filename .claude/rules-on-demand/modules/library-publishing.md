---
description: Publishing packages other projects install (npm, PyPI, crates.io, Maven, Go, Swift) - public API contract, package contents, compatibility matrix, consumer tests on the packed artifact, trusted publishing, deprecation and support policy.
---

# Library Publishing

## When this applies

Activate `library-publishing` in `PROJECT.md` when the project ships packages
that other projects install. Projects that only consume packages do not need it.
List the published packages, registry, scope or namespace, supported runtimes
and peer versions, and support policy in `PROJECT.md`.

For a published package:
- `modules/releases.mdc` still owns version derivation from commits, generated
  changelogs, and signed tags. Its canary, progressive delivery, SLO rollback,
  and post-deploy verification sections do not apply: a registry has no traffic
  to split and consumers choose when to upgrade. This module replaces them.
- `modules/deployments.mdc` applies with "publish" as the deployment: select
  only affected packages, one publishing owner per package.
- `core/dependencies.mdc` applies with the library rule: declare compatible
  ranges, never exact pins, for runtime and peer dependencies.

## Principles

- **Everything exported is public API**, and the public API is a contract.
- **A published version is permanent.** Registries forbid reusing a version and
  restrict unpublishing; consumers pin and cache. Fix forward, never rewrite.
- **Test what you publish**: the packed artifact, installed the way a consumer
  installs it, not the workspace link.
- **Publishing is outward-facing.** Agents prepare releases; they never publish.

## Rules

### Public API surface

- Declare entry points explicitly (`exports` in `package.json`, `__all__`,
  `pub` items, module exports). Anything not reachable from an entry point is
  private, and deep imports are blocked by the `exports` map.
- Commit a **public API report** (API Extractor `*.api.md`, `cargo public-api`,
  `griffe`, or the ecosystem tool) and diff it in CI. Any change to the report
  requires the matching semver bump in the same PR.
- **Type-level changes are breaking**: removing or narrowing an exported type,
  adding a required parameter or property, changing generic constraints, or
  changing an error type callers handle.
- Unstable APIs live behind a separate entry point (for example
  `pkg/experimental`), are excluded from semver guarantees, and say so in the
  README. Never mark a stable export experimental after the fact.
- **Peer dependencies** for anything the consumer owns (frameworks, React,
  database clients): a range covering every supported major, never bundled,
  never duplicated as a regular dependency.

### Package contents and metadata

- Publish from an **allowlist** (`files`, `include`, `MANIFEST.in`), never a
  denylist. CI prints the pack listing (`npm pack --dry-run`, `cargo package
  --list`) and a test asserts it: no tests, fixtures, local config, `.env`, or
  source the package does not need.
- Metadata is complete: SPDX `license` matching `LICENSE`, `repository`,
  `homepage`, `bugs`, `engines` or `requires-python`, `types`, `sideEffects`.
- Build output is validated (`publint`, `@arethetypeswrong/cli`, `twine check`).
  ESM first; ship CommonJS only when a supported consumer needs it.
- Runtime boundaries are explicit: conditional exports (`react-server`,
  `browser`, `node`, `worker`), `server-only` guards on server entry points, and
  `"use client"` directives preserved by the bundler.
- **No install scripts** (`preinstall`, `postinstall`) in published packages.
- Client-side entry points have a size budget (`size-limit` or equivalent) that
  fails CI on regression.

### Versioning in a monorepo

- One version per package, managed by Changesets or release-please in manifest
  mode. A change to an internal dependency bumps its dependants as needed;
  `workspace:` references are rewritten to real ranges at publish time.
- In `0.x`, breaking changes bump the minor and are called out in the notes.
- Pre-releases go to a dist-tag (`next`, `beta`), never to `latest`.

### Compatibility matrix

- Supported runtimes, peer versions, and platform versions are declared in the
  README, `engines`, and peer ranges, and every declared bound is tested.
- CI tests the lowest and highest supported version of each runtime and peer.
- **Consumer tests**: build the tarball, install it into fixture apps (one per
  supported framework major, outside the workspace), and run their build and
  smoke tests. Workspace-linked tests alone do not prove the package works.
- Packages that ship data migrations test the upgrade from every supported
  previous minor of the current major, on a database that contains data.

### Publishing

- Publish **only from CI**, from protected `main` or a release branch, through
  the release workflow. Manual publishing is reserved for a documented recovery.
- Use **trusted publishing (OIDC) with provenance**. No long-lived registry
  token in the repository or in CI secrets. Every maintainer of the scope or
  namespace has two-factor authentication; enable the registry setting that
  requires it for publishing.
- The publish job is the only job with `id-token: write`; it runs pinned
  actions, in a protected environment when the forge supports it.
- One publishing owner per package. Never let two workflows publish the same
  package.

### Deprecation, support, and broken releases

- The README states which majors receive fixes and until when.
- Deprecate before removing: a deprecated API keeps working for at least one
  minor, carries `@deprecated` with its replacement and removal version, and
  warns at runtime in development. Removal happens only in a major, with a
  migration guide.
- **A broken release** gets a fixed patch immediately and the broken version is
  deprecated on the registry with a message pointing to the fix. Unpublishing is
  only for a leaked secret or malicious content, inside the registry window, and
  the leaked secret is rotated regardless.

### Documentation

- Each package README: install command, peer requirements, a minimal working
  example, and a link to the full docs. Examples in docs are compiled or run in
  CI; a broken example fails the build.
- A migration guide for every major version.

## Testing

- **API report test**: the committed report matches the build; a change without
  the matching changeset or version bump fails.
- **Package validation**: `publint` and `@arethetypeswrong/cli` (or the
  ecosystem equivalent) on the build output.
- **Pack listing test**: the exact published file list is asserted.
- **Consumer fixture tests** from the packed tarball across the compatibility
  matrix, including both ends of every peer range.
- **Upgrade tests** for shipped migrations and data formats.
- **Size budget test** for client entry points.
- **Release dry run** in every PR (`changeset status`, release-please dry run)
  so the computed versions are reviewed before merge.
- **Docs example tests**: examples typecheck and run.

## Checklist when touching a published package

- [ ] Entry points explicit; no new export reachable outside them
- [ ] API report updated and the semver bump matches the change, types included
- [ ] Peer ranges cover the supported majors and both ends are tested
- [ ] Published files come from an allowlist; pack listing test updated
- [ ] `publint` / `@arethetypeswrong/cli` (or equivalent) clean; no install scripts
- [ ] Consumer fixture apps pass from the packed tarball
- [ ] Changeset or release note written; pre-releases on a dist-tag
- [ ] Publishing only from CI with trusted publishing and provenance; no registry token stored
- [ ] Deprecations carry replacement, removal version, and runtime warning
- [ ] README, docs examples, and migration guide updated

# Ruleset changelog

This changelog describes the shared ruleset, not any consuming application's
releases. Installed commits are recorded in `.ruleset-version`. Entries remain
under Unreleased until committed/released; the installed SHA is the precise
version reference. Do not imply that uncommitted edits have a released version.

## Unreleased

### New requirements

- New `library-publishing` module for projects that ship packages: public API
  report and type-level semver, allowlisted package contents, compatibility
  matrix with consumer tests on the packed tarball, trusted publishing with
  provenance and no stored registry token, deprecation and broken-release policy.
  It replaces the canary and rollback sections of `releases.mdc` for packages.
- New `open-source` module for public repositories: never-publish list (business
  context and personal emails included), going-public procedure, history-wide
  secret scanning, clean-room rule for incompatible licenses, governance files,
  and fork and workflow security.
- Migration: tick `library-publishing` and/or `open-source` in `PROJECT.md`
  section 9 when they apply, then run `init.sh --update`. No change for
  projects that do neither.
- Plan CI/CD before implementation. Merged PRs into protected `main` trigger
  impact analysis and deployment of affected units only, including transitive
  dependencies. Track successful deployment state separately per unit/environment.
- Migration: activate `deployments`, fill the CI/CD plan in `PROJECT.md`, configure
  hosting/CI ownership, and test selection/no-op/retry cases before enabling CD.
  Existing workflows are preserved by update and must be adapted manually.


- Shared design system: semantic tokens, reusable components, explicit variants
  and states, catalogue, consistent icons, and automated enforcement.
- Validated configuration boundaries, authoritative business rule ownership,
  architecture dependency checks, preservation of existing work, and protection
  against instructions embedded in external content.
- Optional `data-lifecycle` and `audit-trail` modules, activated according to the
  project's persistent data and sensitive operations.
- Scoped adoption for existing projects: baseline findings and planned migration,
  with documented temporary legacy exceptions and no blanket rewrite.
- Ruleset integrity, installation, update, and hook regression tests via
  `make check`, with Linux/macOS CI.

### Behavior changes

- `init.sh --target` accepts `codex`, `all` (Claude, Cursor, and Codex), and
  comma-separated lists such as `claude,codex`; `both` keeps meaning Claude and
  Cursor. The Codex target writes `AGENTS.md` from `templates/AGENTS.md` with a
  generated rule index (rebuilt on update, text above it preserved). It reuses
  `.claude/` rules and skills when Claude is a target, otherwise installs them
  under `.agents/`. Codex has no hooks: `AGENTS.md` makes the check command and
  secret hygiene explicit, and CI remains the enforcement gate.
  Migration: none for existing targets. To add Codex, run
  `init.sh --dest <project> --target <current>,codex --update` and commit
  `AGENTS.md`.
- The release workflow template now handles version metadata only; its blanket
  deployment jobs were removed. Configure affected-unit delivery from main merges
  in the hosting integration or a project-specific pipeline. Existing projects
  must review their preserved release workflow to avoid duplicate/global deploys.


- `modules/data-fetching.mdc` owns the mutation feedback policy. Optimistic UI
  requires predictable results, low risk, and reliable rollback. Money,
  permissions, destructive/irreversible actions, scarce-resource reservations,
  and unpredictable output wait for server confirmation. Offline replay follows
  the same restrictions; rollback must preserve newer successful writes.
- Claude's pre-commit hook now blocks recognized commits when the check command
  is absent, empty, whitespace-only, or failing, and blocks malformed hook input
  or an inaccessible verification directory. Verification logs are private
  temporary files, removed on exit.
- The write hook scans docs, examples, and fixtures as well as code. Malformed
  payloads or decoding failures block writes. Placeholder examples remain valid;
  credential-shaped example values must be replaced with obvious placeholders.
- `init.sh` distributes this file as `docs/reference/ruleset-changelog.md`,
  refreshes it on update, and prints the previous/current installed SHA.
  It never overwrites the application's own `CHANGELOG.md`.

### Migration for consuming projects

1. Before updating, record `.ruleset-version`, read the source ruleset changelog
   for intervening changes, and capture the project's current check results.
   If the installed SHA is unavailable, compare installed files with the source
   rather than assuming a clean or fully migrated state.
2. Configure and run the real verification command. For Claude, store it on one
   line in `.claude/check-command` or supply `CHECK_COMMAND`; the documented
   ecosystem fallbacks remain available. A no-op is not a valid verification.
3. Run `init.sh --dest <project> --target <installed-target> --update` and review
   the diff and the installed ruleset changelog. Pass the target explicitly when
   the project uses only Claude or only Cursor.
4. Existing `PROJECT.md`, `TEST_PLAN.md`, workflows, registries, and Claude
   settings are preserved. Manually add applicable new module entries and the
   configuration, architecture, governance, and adoption fields from the template.
   Check hook wiring against the source settings; update does not merge it for you.
5. Classify existing mutations using the new feedback policy. Prioritize money,
   permissions, destructive operations, reservations, and unsafe offline queues;
   add pending/confirmation tests and overlapping-write rollback coverage.
6. Replace credential-shaped examples with placeholders. Keep repository/CI secret
   scanning enabled: Claude hooks do not cover shell writes, other editors, or
   every possible command spelling and are not a security sandbox.
7. Inventory unrelated legacy gaps in `BACKLOG.md`/`docs/DEBT.md`, with owners and
   scoped migration steps. Apply rules to the changed scope without rewriting
   the entire project. Report existing failing checks honestly.
8. Run the project check and relevant tests, audit `TEST_PLAN.md`, and record the
   source/target SHA plus migration completion in `PROJECT.md`. The installed SHA
   records file distribution, not proof that every migration has been completed.

### Corrections

- `templates/scripts/check-licenses.mjs` evaluated every SPDX expression as if
  all operators were `OR`, so `MIT AND GPL-3.0` passed. It now parses the
  expression (`AND` needs every license allowed, `AND` binds tighter than `OR`,
  `WITH` exceptions are not allowlisted) and fails closed on malformed input.
  Migration: run `init.sh --update` (the script is ruleset-owned), then rerun the
  license check; newly reported packages were already non-compliant.
- `core/dependencies.mdc` now lists the same license allowlist as the script,
  restricts MPL-2.0 to unmodified dependencies and CC-BY-4.0 to data and docs,
  and forbids copying code from incompatible licenses (clean-room reimplementation).
- Workflow templates now follow `modules/infra.mdc`: actions pinned by commit
  SHA (including `trivy-action`, previously `@master`), `contents: read` at the
  workflow level with write permissions granted per job, `persist-credentials:
  false` on every checkout, a timeout on every job, and expressions passed to
  scripts through `env` instead of being interpolated into `run`. The secret
  scan installs the gitleaks CLI with a verified checksum, because
  `gitleaks-action` requires a paid license on organization repositories. The
  pre-production template defines the `NODE_VERSION` it uses, and the trivy
  `severity` value is quoted so it is not split by the YAML flow mapping.
  Migration: workflows are project-owned and are not updated by `--update`;
  compare yours with the new templates and apply the same changes manually.
- `init.sh` wrote the absolute local path of the ruleset clone into
  `.ruleset-version` (`source=`), which projects commit, exposing the machine's
  user name and directory layout. It now records the clone's `origin` URL with
  any credentials stripped, or `unknown`. `/health-check` compares with
  `git ls-remote <source> HEAD`. Migration: run `init.sh --update`, then check
  that the committed `.ruleset-version` no longer contains a local path; public
  repositories should treat the old value as already published.
- Fixed stale maintenance rule references, missing rule activation metadata,
  and missing checklists detected by the integrity checks.

## Historical baseline

Changes before this changelog are documented by Git history. No release dates
or version numbers have been reconstructed. Use the installed SHA to determine
which baseline a consuming project actually has.

---
description: Dependency policy - adding, pinning, updating, auditing, licensing, and removing dependencies; supply-chain hygiene; verifying real versions and APIs before use. Project-agnostic.
---

# Dependencies

## When this applies

Applies to every project and every language. The package manager, registry,
license exceptions, and Renovate schedule live in `PROJECT.md`;
language-specific commands are in `languages/*.mdc`. Secrets and credential
rules are in `core/security.mdc`; the maintenance cadence that reviews
dependencies is in `core/maintenance.mdc`.

## Principles

- **Every dependency is a liability** with a maintenance cost, an attack
  surface, and a license. The default answer is no.
- **Reproducible installs**: same lockfile, same bytes, everywhere.
- **Updates are continuous and automated**; a big-bang upgrade is a failure of
  process.
- **Never guess an API.** The installed version and its documentation are the
  source of truth, not memory.

**Native SDKs first.** When a platform, provider, or runtime ships an
official first-party SDK for the project's language, use it. Do not write raw
HTTP clients for APIs that have one, do not wrap an official SDK with a
community package, and do not replace a native platform primitive with a
third-party re-implementation. Raw HTTP is allowed only when no official SDK
exists, behind the typed wrapper described in `integrations.mdc`.

## Rules

### Before adding a dependency

Answer all of these in the PR description; a "no" on any of the first four
blocks the addition.

| Criterion | Requirement |
|---|---|
| Maintained | Release or commit in the last 12 months; issues answered; more than one maintainer for anything on a critical path |
| License | On the allowlist of `templates/scripts/check-licenses.mjs` (MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD, CC0-1.0, Unlicense, MPL-2.0, Python-2.0, BlueOak-1.0.0, CC-BY-4.0). Anything else (GPL, LGPL, AGPL, SSPL, BUSL, commercial, unlicensed) needs an exception in `PROJECT.md` |
| Security history | No unresolved advisories; past advisories fixed promptly |
| Could we write it | If the needed subset is under 100 lines, write it and test it instead |
| Size | Bundle or binary impact measured for client-side code; no package that pulls a framework for one helper |
| Transitive count | Total new packages reported; more than 20 needs a justification |
| Alternatives | The standard library and already-installed packages checked first |

- **One package per job**: never two libraries doing the same thing (two HTTP
  clients, two date libraries) without a migration plan and a `DEBT.md` entry.
- **Dev dependencies are dependencies**: same criteria, same audit.

### Lockfiles and pinning

- **The lockfile is committed** and never gitignored; one lockfile per
  workspace root, matching the package manager in `PROJECT.md`.
- **CI installs frozen**: `pnpm install --frozen-lockfile`, `npm ci`,
  `uv sync --locked`, `poetry install --sync`, `cargo build --locked`,
  `go mod verify`. A lockfile change during CI fails the job.
- **Applications pin exact versions** in the manifest (`"1.4.2"`, not
  `"^1.4.2"`); the lockfile pins transitive versions.
- **Libraries declare ranges** compatible with semver (`^1.4.0`) so consumers
  can dedupe; the library's own lockfile is for its CI only.
- **Runtime versions are pinned too** (`.node-version`, `.python-version`,
  `rust-toolchain.toml`) and match the CI matrix and the container base image.

### Automated updates

- **Renovate is configured** from `templates/renovate.json` and enabled on
  every repository. Dependabot is acceptable only where Renovate cannot run.
- **Grouping**: minor and patch updates grouped into one weekly PR per
  ecosystem; each major update is its own PR; lockfile maintenance weekly.
- **Security updates open immediately**, outside the schedule, labeled `security`.
- **Automerge only for dev dependencies** (linters, formatters, test tools,
  type packages) with a green pipeline; runtime dependencies always get a
  human review.
- **Update PRs are reviewed in the weekly ritual** (`core/maintenance.mdc`);
  an update PR older than 30 days is a debt item.
- **Digest pins for actions and container images** are updated by Renovate as
  well (`modules/infra.mdc`).

### Vulnerability scanning

- **The audit runs in CI on every PR and daily on `main`**; high or critical
  severity blocks merge.
- **Suppressions are explicit**: an ignore entry carries the advisory id, the
  reason, an owner, and an expiry date no more than 30 days out.
- **Transitive vulnerabilities count**: use overrides or resolutions to force a
  fixed version and file an upstream issue.
- **Runtime images are scanned** with `trivy` in addition to package audits.

### License scanning and SBOM

- **The license check runs in CI** against the allowlist above; a
  non-allowlisted license fails the job unless listed as an exception in
  `PROJECT.md`. SPDX expressions are evaluated: `OR` needs one allowed
  option (record which one the project uses), `AND` needs every license allowed.
- **MPL-2.0 is allowed unmodified only**: its copyleft applies per file, so
  patching or vendoring MPL files requires publishing those files under MPL.
  CC-BY-4.0 is for data and documentation packages, never for code.
- **Never copy code from an incompatible license.** Reading GPL, AGPL, or
  commercial source and rewriting it creates a derivative work. Reimplement
  such features clean-room from documentation and observed behavior only.
- **An SBOM is generated on every release build** (CycloneDX or SPDX via
  `syft`, `cdxgen`, `trivy sbom`, or the ecosystem tool) and stored with the
  release artifacts.

### Removing unused dependencies

- **Unused dependency detection runs monthly** (`core/maintenance.mdc`) and
  before any major upgrade; every reported package is removed or justified.
- **Removal is its own `chore(deps)` commit**, with the lockfile diff.
- **Replacing a dependency with in-house code** needs tests covering the
  subset that was used.

### Major upgrades

1. Read the changelog and migration guide for every skipped version.
2. Branch `chore/upgrade-<package>-<major>`; upgrade only that package and its
   required peers.
3. Fix breakages; run the full suite including integration and E2E.
4. Update `PROJECT.md` (stack table) and any docs quoting the old API.
5. One major upgrade per PR; never bundle several majors.

### Verify real versions and APIs

- **Before writing code that uses a library, check the installed version**
  (`pnpm list <pkg>`, `pip show <pkg>`, `cargo tree -p <pkg>`, `go list -m all`)
  and read the documentation or type definitions for that version.
- **Never write an API call from memory.** If the signature is not visible in
  `node_modules`, the type stubs, or the fetched docs, look it up first; never
  guess parameter names, defaults, or return shapes.
- **Never invent a package.** A package that cannot be found on the registry
  with the expected maintainer and download count is not added.
- **Prefer the version already in the lockfile** over adding a newer parallel
  version; upgrade deliberately (above) instead.

### Supply chain

- **No install scripts from unknown packages**: `pnpm` blocks them by default,
  allow specific packages in `pnpm.onlyBuiltDependencies`; use
  `--ignore-scripts` in CI for npm and yarn and review any package that needs one.
- **Require provenance where available**: npm provenance attestations, PyPI
  trusted publishing, Sigstore signatures, crates from crates.io only.
- **Typosquat defense**: copy package names from the registry page, never type
  them from memory; check download counts and publish dates; a package
  published less than 30 days ago needs a justification.
- **Private registry rules**: scoped packages resolve only from the private
  registry (`.npmrc` scope mapping); public names are never shadowed
  (dependency-confusion defense); registry credentials are CI secrets.
- **Lockfile integrity hashes are verified** (`npm ci`, `pnpm` default,
  `pip --require-hashes` where applicable).
- **A maintainer change or ownership transfer** of a critical dependency is a
  review trigger, not a silent update.

### Vendoring

- **Vendor only when the registry cannot serve** (air-gapped builds, patched
  fork awaiting upstream merge). A vendored package lives under `vendor/`,
  keeps its license file, records upstream URL, version, and applied patch,
  and has a `DEBT.md` entry with a return-to-upstream date.
- **Patch, do not fork, for small fixes**: `pnpm patch`, `patch-package`, or
  `[patch.crates-io]`; the patch file is committed and reviewed.

### Deprecations

- **A deprecation warning from a dependency is a task**: open an issue, plan
  the migration before the removal version, never silence the warning.
- **Packages marked deprecated on the registry are replaced within 90 days.**
- **End-of-life runtimes** (Node, Python, Go versions) are upgraded before
  their EOL date; the date is tracked in `PROJECT.md`.

### Per-ecosystem tooling

| Ecosystem | Install (frozen) | Audit | Unused | License / SBOM |
|---|---|---|---|---|
| Node / TypeScript | `pnpm install --frozen-lockfile` | `pnpm audit`, `npm audit` | `knip`, `depcheck` | `license-checker`, `cdxgen` |
| Python | `uv sync --locked` | `pip-audit` | `deptry` | `pip-licenses`, `cyclonedx-py` |
| Rust | `cargo build --locked` | `cargo audit`, `cargo deny` | `cargo udeps` | `cargo deny`, `cargo cyclonedx` |
| Go | `go mod verify`, `go mod tidy -diff` | `govulncheck` | `go mod tidy` | `go-licenses`, `syft` |
| JVM | Gradle or Maven lockfiles | OWASP `dependency-check` | build plugin | `cyclonedx` plugin |
| Containers / actions | Digest pins | `trivy` | n/a | `trivy sbom` |

The project's single check command (`make check` / `pnpm check`) runs the audit
and unused-dependency checks alongside typecheck, lint, and tests.

## Testing

- **Frozen install test**: CI fails when the lockfile is out of date with the
  manifest.
- **Audit test**: high or critical advisories fail the pipeline; suppressions
  past their expiry date fail the pipeline.
- **License test**: a non-allowlisted license fails the pipeline.
- **Unused dependency test**: the monthly job reports and fails on unused packages.
- **Upgrade tests**: a dependency update PR runs the full suite (unit,
  integration, E2E, contract) exactly like a feature PR; automerge requires
  all of them.
- **Contract tests** against third-party SDK wrappers
  (`modules/integrations.mdc`) catch behavior changes that types do not.
- **Bundle size test** for client code: a size budget check fails on regression.
- **SBOM presence test**: the release job fails without an SBOM artifact.

## Checklist when touching dependency code

- [ ] Addition justified against the criteria table in the PR description
- [ ] License on the allowlist or an exception recorded in `PROJECT.md`
- [ ] No code copied or translated from an incompatible license; clean-room reimplementation documented
- [ ] Installed version checked and the real API read before writing code
- [ ] Exact pin for apps, range for libraries; lockfile committed and updated
- [ ] CI install is frozen; runtime version pinned and matching CI
- [ ] Audit, license, and unused checks pass; no expired suppressions
- [ ] No install scripts enabled without review; provenance verified
- [ ] Renovate config present and grouping rules respected
- [ ] Major upgrade in its own PR with changelog read and `PROJECT.md` updated
- [ ] Removed packages deleted from manifest, lockfile, and docs
- [ ] Vendored or patched packages have a `DEBT.md` entry with a return date

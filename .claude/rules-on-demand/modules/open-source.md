---
description: Public repositories and open-source distribution - what must never be published, history and identity hygiene, licensing and clean-room rules, fork and workflow security, disclosure, governance files, forge settings.
---

# Open Source and Public Repositories

## When this applies

Activate `open-source` in `PROJECT.md` when the repository is public, will
become public, or distributes source under an open-source license. Record the
license, copyright holder, contribution policy (inbound = outbound, DCO, or
CLA), and disclosure contact in `PROJECT.md`. This module extends
`core/security.mdc` (secrets) and `core/dependencies.mdc` (licenses); packages
published to a registry also follow `modules/library-publishing.mdc`.

## Principles

- **Everything pushed is published forever.** Forks, mirrors, caches, archives,
  and search engines keep it. Removing a commit does not unpublish it.
- **Treat every contribution from a fork as untrusted**, including its code,
  its workflow changes, and its dependencies.
- **The license is a promise** to users and a limit on what the project may
  include.

## Rules

### Never publish

- Credentials, tokens, keys, certificates, `.env` files, database dumps
  (`core/security.mdc`).
- **Business context that is not meant to be public**: client names and client
  project names, internal hostnames and URLs, internal account, project, or
  tenant identifiers, links to internal tickets or CRMs, internal pricing,
  screenshots of client products, real personal data.
- **Personal email addresses**: contributors commit with the forge's noreply
  address, configured before the first commit, and enable the forge option that
  blocks pushes exposing a private address.
- Internal runbooks or infrastructure details. They live in a private repository.
- Examples, fixtures, and seeds use synthetic data, reserved domains
  (`example.com`), and identifiers that are obviously fake.

### Making a private repository public

1. Scan the full history for secrets (`gitleaks git`) and review every finding.
2. List author and committer emails (`git log --format='%ae%n%ce' | sort -u`).
3. Review issues, pull requests, comments, and releases for business context.
4. If anything sensitive is in the history, **publish a fresh history** (new
   repository from a cleaned tree) instead of changing visibility.
5. Rotate any credential that ever appeared in the history before going public.

### Detection

- CI scans the **full history** for secrets on every push, every pull request,
  and on a schedule, with a checksum-verified scanner.
- Forge secret scanning and **push protection** are enabled.
- A local pre-commit scan runs through a Git hook (`core.hooksPath`) so that
  every editor and agent is covered, not only tools with their own hooks.
- **A leaked secret is revoked and rotated first**, then history is cleaned if
  needed, then users are informed through an advisory if they are affected.

### Licensing and provenance

- `LICENSE` at the root with the SPDX identifier and the legal entity as
  copyright holder; package metadata uses the same identifier.
- Inbound code keeps its license: vendored or copied third-party code comes only
  from compatible licenses, keeps its notice, and is listed in
  `THIRD_PARTY_NOTICES`.
- **Never copy or translate code from an incompatible license** (GPL, AGPL, or
  commercial into a permissive project). Reimplement such features clean-room:
  write the behavior specification first, build only from documentation,
  observed behavior, and open format specifications, never read the
  incompatible source, and record this in the pull request.
- `CONTRIBUTING.md` states that contributions are accepted under the project
  license, plus the DCO sign-off or CLA when `PROJECT.md` requires one.

### Governance files

- `README.md`, `LICENSE`, `SECURITY.md` (private reporting channel, response
  targets, supported versions), `CONTRIBUTING.md` (setup, rules, secret hygiene,
  policy on AI-assisted contributions), `CODE_OF_CONDUCT.md`, issue and pull
  request templates, and `CODEOWNERS` covering workflows, release configuration,
  and security-sensitive code.

### Forge and workflow security

- Default branch protected: pull request required, required checks, no force
  push, no deletion. Signed commits when `PROJECT.md` requires them.
- Workflow token read-only by default; write permissions granted per job.
- **Fork pull requests**: require maintainer approval before workflows run for
  outside contributors; never use `pull_request_target` or `workflow_run` to
  check out or execute pull request code; secrets and `id-token` are never
  available to fork-triggered runs; caches written by untrusted runs are never
  restored by release jobs.
- Private vulnerability reporting, dependency alerts, and security updates
  enabled. Unused features (wiki, projects) disabled.

### Reviewing outside contributions

- Review for binaries, minified or obfuscated code, new or renamed
  dependencies (typosquats), install scripts, and changes to workflows or
  release configuration. Workflow and release changes need a code owner review.
- AI-assisted contributions meet the same bar; the contributor is responsible
  for every line.
- A security report filed as a public issue is moved to a private advisory and
  the public copy is edited or removed. Sensitive data posted by a reporter is
  removed promptly.

## Testing

- **Secret scan** on full history in CI (push, pull request, schedule). Verify
  the scanner works by running it on a disposable branch containing a fake
  canary pattern, never a real secret.
- **License check** of dependencies in CI (`core/dependencies.mdc`).
- **Workflow analysis**: `actionlint` and `zizmor` (or equivalent) fail on
  unpinned actions, excessive permissions, `pull_request_target` misuse, and
  template injection.
- **Identity audit**: a monthly check that no new author or committer email
  outside the noreply domain appeared in the history.
- **Forge settings audit**: secret scanning, push protection, private reporting,
  and branch protection verified by script or by the monthly maintenance ritual.

## Checklist when touching a public repository

- [ ] No credential, business context, personal email, or real personal data in the change
- [ ] Examples and fixtures synthetic, with reserved domains and fake identifiers
- [ ] Commits use the noreply address; local secret scan hook enabled
- [ ] CI secret scan on full history green; push protection enabled
- [ ] New third-party code compatible, noticed, and listed; nothing copied from an incompatible license
- [ ] Clean-room procedure followed and recorded when reimplementing a feature of incompatible software
- [ ] Workflows: read-only default token, no fork code run with secrets, no `pull_request_target` checkout
- [ ] Governance files current (`SECURITY.md`, `CONTRIBUTING.md`, `CODEOWNERS`, templates)
- [ ] Outside contributions reviewed for binaries, obfuscation, dependencies, and workflow changes

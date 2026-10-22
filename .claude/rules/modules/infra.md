---
description: CI/CD pipelines and infrastructure - stages, environments, secrets in CI, Docker, IaC, DNS/TLS, backups, rollback, cost guardrails. Apply to workflow, container, and IaC files.
paths:
  - ".github/**"
  - "**/Dockerfile*"
  - "**/docker-compose*"
  - "**/*.tf"
  - "**/wrangler.*"
  - "**/vercel.json"
  - "**/fly.toml"
---

# Infrastructure & CI/CD

## When this applies

Apply to every file matching the globs, and whenever `PROJECT.md` declares a
deployment platform, a container runtime, or an IaC tool. Platform accounts,
regions, required check names, budgets, and RPO/RTO targets live in `PROJECT.md`.
Branching, PR, and commit rules are in `core/github-workflow.mdc`; the secrets
baseline is in `core/security.mdc`; progressive delivery and rollback thresholds
are in `modules/releases.mdc`; serverless function structure is in
`modules/integrations.mdc`. Deployment planning, merge triggers, and affected-unit
selection are governed by `modules/deployments.mdc`; read it before editing CI/CD.

## Principles

- **Everything is reproducible from the repository.** If it is not in git, it
  does not exist: pipelines, images, infrastructure, DNS.
- **The pipeline is the only road to production.** No manual deploys, no
  console edits, no SSH-and-patch.
- **Build once, promote many.** The artifact tested in staging is the artifact
  that ships; never rebuild between environments.
- **Environments differ only in size and data**, never in code, config keys, or
  runtime versions.
- **Every deploy is verified and reversible** within minutes.

## Rules

### Pipeline stages

Run stages in this order; a failure stops the pipeline.

| Stage | Runs | Blocks merge |
|---|---|---|
| 1. Lint / typecheck | Formatter check, linter, type checker, `actionlint`, `hadolint`, `tflint` | Yes |
| 2. Unit | Unit and property tests with the coverage threshold | Yes |
| 3. Integration | Tests against real services in containers (`docker compose`) | Yes |
| 4. Build | Application build, container image, SBOM | Yes |
| 5. E2E | Browser or API E2E against the preview environment | Yes |
| 6. Security scans | Dependency audit, container scan, IaC scan, secret scan | Yes on high/critical |
| 7. Deploy | Promote the built artifact; smoke tests; verification gate | n/a |

- **Required checks are listed by name in `PROJECT.md`** and enforced by branch
  protection. Never mark a check optional to merge; fix or revert instead.
- **Every job has `timeout-minutes`** and a `concurrency` group per branch with
  `cancel-in-progress: true` (never on the production deploy job).
- **Cache by lockfile hash** (package manager store, build cache, test cache).
  Never cache installed `node_modules` or virtualenvs directly; cache the store.
- **Matrix builds** cover the runtime versions `PROJECT.md` supports, with
  `fail-fast: false` so one failing cell does not hide the others.
- **Pin third-party actions by commit SHA** with the version as a comment;
  Renovate keeps them current (`core/dependencies.mdc`). Start new workflows
  from `templates/github/workflows/`.
- **A preview environment per PR** is created on open, updated on push, and
  destroyed on close. It uses synthetic seed data, never production data.

### Environments and promotion

- **Promotion path is `dev` -> `preview`/`staging` -> `production`.** Production
  delivery starts after a PR merges into protected `main`; only affected units
  deploy after their gates pass (`modules/deployments.mdc`). Tags identify artifacts.
- **Same image, same commit SHA** across the path; the deploy records the SHA.
- **Parity**: identical Dockerfile, runtime version, env var names, and
  migrations. List intentional differences (replicas, instance size, flag
  defaults) in `PROJECT.md`; anything else is a bug.
- **Every env var is declared in `.env.example`** and in the platform config; a
  missing var fails startup and never falls back silently.
- **Production has protection rules**: required reviewer, deployment branch
  restriction, and a wait timer where the platform supports it.

### Secrets in CI

- **OIDC federation over long-lived keys**: CI authenticates to the cloud
  provider with short-lived tokens. A stored cloud key is a `DEBT.md` item
  with a removal date.
- **Scope every secret to one environment** and the minimum permissions; the
  preview environment never holds production secrets.
- **Never echo a secret**: no `echo $TOKEN`, no `set -x` around secret use, no
  secrets in build args, image layers, artifacts, or cache keys.
- **`permissions:` is explicit per workflow**, default `contents: read`.
- **Secret scanning runs in stage 6** (`gitleaks` or platform-native); a hit
  fails the pipeline and triggers rotation per `core/security.mdc`.

### Docker

- **Multi-stage builds**: a build stage with the toolchain, a runtime stage
  with the artifact only.
- **Base images pinned by digest** (`image:tag@sha256:...`); Renovate updates them.
- **Non-root `USER`** in the final stage; read-only filesystem where possible.
- **`.dockerignore` is mandatory**: exclude `.git`, env files, tests, docs, caches.
- **`HEALTHCHECK` declared** and pointing at the readiness endpoint.
- **One process per container**; no supervisord, no cron inside the app image.
- **No secrets in layers**: use `--mount=type=secret` at build time or runtime env.

```dockerfile
FROM node:22-alpine@sha256:<digest> AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine@sha256:<digest>
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/readyz || exit 1
CMD ["node", "dist/server.js"]
```

### Infrastructure as code

- **All infrastructure is declared** (Terraform, Pulumi, `wrangler.*`,
  `fly.toml`, `vercel.json`); the tool is named in `PROJECT.md`.
- **Plan in PR, apply from `main`**: the plan output is posted on the PR and
  reviewed like code; apply runs only in the pipeline after merge.
- **State is remote, locked, encrypted, and versioned**; never committed, never local.
- **No click-ops.** A console change made under incident pressure is imported
  into code or reverted within 24 hours and logged in `DEBT.md`.
- **Drift detection runs daily** (`terraform plan -detailed-exitcode` or the
  platform equivalent); drift opens an issue.
- **Modules and providers pinned**; every resource tagged with project,
  environment, and owner.

### DNS and TLS

- **DNS records live in IaC** or in the registry named in `PROJECT.md`.
- **TLS is automated** (ACME or platform-managed); no manually renewed certificates.
- **HSTS on**, HTTPS redirect on, `CAA` record set, DNSSEC where supported.
- **Lower TTLs before a migration** and restore them after; never cut over
  behind a 24-hour TTL.

### Backups and restore

- **Automated daily backups** of every stateful store, encrypted, with a copy
  outside the primary platform. Retention, RPO, and RTO are in `PROJECT.md`.
- **A backup that has not been restored is not a backup**: restore drill
  monthly into an isolated environment (schedule in `core/maintenance.mdc`).
- **The restore procedure is a runbook** with exact commands, validated on the drill.

### Rollback

- **The previous artifact stays deployable**; rollback is one pipeline action.
- **Migrations follow expand/contract** (`modules/database.mdc`) so a code
  rollback never requires a schema rollback.
- Thresholds, automated rollback, and the procedure are in `modules/releases.mdc`.

### Cost guardrails

- **A budget with alerts at 50%, 80%, and 100%** per account and per
  environment; amounts in `PROJECT.md`.
- **Autoscaling always has a maximum**; no unbounded concurrency or replicas.
- **Preview environments are destroyed on PR close** and expire after 7 idle days.

### Deployment platforms

| Platform | Non-negotiables |
|---|---|
| Vercel | Git-linked project, preview per PR, env vars per environment, `vercel.json` in repo, production only from `main`, no long-running work inside functions |
| Cloudflare | `wrangler.*` in repo, secrets via `wrangler secret` or CI, bindings declared, staged environments, no `--force` deploys, observability enabled |
| Fly.io | `fly.toml` in repo, image built in CI and deployed by digest, health checks declared, volumes backed up, `min_machines_running` set on purpose |
| GCP Cloud Run | Image by digest from Artifact Registry, Workload Identity (OIDC) from CI, revision traffic split for canaries, min/max instances set, one service account per service |
| Self-hosted | Container by digest, reverse proxy with automated TLS, non-root, compose or orchestrator config in repo, backups and monitoring verified before first production traffic |

### Tooling

| Purpose | Tool |
|---|---|
| Workflow lint | `actionlint` |
| Dockerfile lint | `hadolint` |
| IaC format and lint | `terraform fmt`, `terraform validate`, `tflint` |
| IaC security | `checkov` or `tfsec` |
| Container and SBOM scan | `trivy` |
| Secret scan | `gitleaks` |
| YAML / JSON format | the project formatter (Prettier or equivalent) |

The project's single check command (`make check` / `pnpm check`, see
`PROJECT.md`) runs the infra linters alongside typecheck, lint, and tests.

## Testing

- **Pipeline tests**: run changed workflows with `act` locally or a
  `workflow_dispatch` dry run on a branch before merging; `actionlint` on every
  workflow change.
- **Container scanning**: `trivy image` on the built image; fail on high or
  critical; publish the SBOM as a build artifact.
- **IaC scanning**: `checkov` or `tfsec` plus `terraform validate` on every PR;
  a human reviews the plan diff.
- **Smoke tests post-deploy**: hit `/healthz`, `/readyz`, and one critical user
  path against the real URL; a failure triggers rollback.
- **Health endpoints**: `/healthz` (process alive, no dependencies) and
  `/readyz` (database, cache, queue reachable); readiness gates traffic.
- **Deploy verification gate**: watch error rate and p95 latency for the window
  defined in `modules/releases.mdc` before marking the deploy successful.

## Checklist when touching infra code

- [ ] Delivery plan reviewed; affected-unit selection and hosting ownership tested
- [ ] Stage order respected; required checks in `PROJECT.md` still pass
- [ ] Every job has a timeout and a concurrency group; actions pinned by SHA
- [ ] Caches keyed on lockfile hash; matrix covers supported runtimes
- [ ] Preview environment created and destroyed with the PR; synthetic data only
- [ ] Same artifact promoted across environments; parity differences documented
- [ ] Secrets scoped per environment, OIDC used, nothing echoed or baked in
- [ ] Dockerfile: multi-stage, digest-pinned base, non-root, healthcheck, `.dockerignore`
- [ ] IaC plan reviewed in the PR; state remote and locked; no click-ops
- [ ] Backups, restore runbook, and rollback path exist for every stateful change
- [ ] Budget alerts and autoscaling maximums set; previews expire
- [ ] Post-deploy smoke tests and verification gate configured
- [ ] `PROJECT.md` deployment section updated

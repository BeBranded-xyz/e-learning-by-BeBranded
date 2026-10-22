---
description: Plan CI/CD before implementation and deploy only affected application units after a PR merges into main. Covers dependency impact, hosting triggers, deployment baselines, ordering, and recovery.
---

# Deployment Planning and Selection

## When this applies

Apply whenever creating or changing CI/CD, hosting integration, deployment
commands, or deployable application boundaries. Activate `deployments` in
`PROJECT.md` for projects that deploy software. `infra.mdc` owns pipeline
infrastructure and `releases.mdc` owns versioning and rollout safeguards.
This module owns deployment triggers and the selection of affected units.
For published packages, publishing is the deployment and each package is a
unit; `library-publishing.mdc` owns how a package is published.

## Plan before implementing

- Before editing pipeline configuration, document the delivery plan in
  `PROJECT.md` or its linked deployment document. Review the plan in the PR.
- Inventory deployable units: hosting app, API, worker, function group, mobile
  binary, database migrations, and infrastructure where applicable. A unit is
  what the platform can deploy independently; a component is not necessarily
  an independent deployment.
- For each unit, declare source paths, build inputs, shared dependencies, target
  environment, deployment owner (hosting integration or CI job), artifact,
  validation commands, rollout procedure, and rollback target.
- Define events and gates: PR validation/previews, merge into main, affected-unit
  selection, artifact verification, migrations, promotion, and post-deploy checks.
- Record the dependency graph, ordering constraints, deployment state storage,
  concurrency policy, credentials, and failure/retry behavior before enabling CD.
- A new unit or shared dependency updates this plan and the selector in the same
  PR. Never add a deployment command without specifying when and why it runs.

## Trigger from merged main

- Normal production delivery starts with commits on a feature branch, a checked
  and reviewed PR, and its merge into protected `main`. Local commits, feature
  pushes, and unmerged PRs do not authorize a production deployment.
- The resulting main revision starts impact analysis automatically. A push-to-main
  trigger is valid when branch protection requires PR merges; do not rely on a
  commit message or the existence of a merge commit (squash merges also count).
- PR previews are isolated from production. Required checks must pass for the
  exact revision/artifact being promoted; do not race deployment against CI.
- Release tags and notes identify artifacts; they must not create a second
  deployment or delay the impact analysis until an unrelated release PR merges.
- Select one deployment owner per unit/environment. If hosting auto-deploys from
  Git, configure its affected-build/ignore mechanism or gate it through CI.
  Never let both a hosting integration and a CI job deploy the same unit twice.
- Document platform limitations. If the hosting system deploys an entire app as
  one artifact, deploy that unit when affected; leave independent apps untouched.

## Select only affected units

- Compute the units whose effective build/runtime inputs changed and include
  transitive dependants of shared packages, contracts, generated code, and config.
  Folder-only filters are insufficient when dependencies cross directories.
- Evaluate lockfile/runtime/toolchain/build-config changes for every consumer
  whose output or behavior can change. Do not automatically ignore root files.
- Documentation/test-only changes produce no production deployment unless those
  files are inputs to a deployed unit (for example a documentation site).
- Treat migrations and infrastructure as separately planned changes with explicit
  dependants and ordering; a database change does not automatically redeploy all
  apps, but compatibility must be verified against every affected consumer.
- Keep CI coverage and deployment selection separate. A shared contract change
  may require broad tests while deploying only units with changed runtime inputs.
- Output a reviewable plan: target revision, selected units, changed inputs and
  reasons, skipped units and reasons, ordered prerequisites, and artifacts.
  An empty plan is a successful no-op, not a reason to deploy everything.
- Unknown paths, missing history, or an invalid dependency graph must not be
  treated as "nothing changed". Stop with an actionable error or use a documented
  conservative selection of potentially affected units, explaining why.
- A full deployment is justified only when all units are affected, on initial
  provisioning, or for an explicitly documented recovery operation. Never make
  "redeploy everything just in case" the normal path.

## Baselines, execution, and recovery

- Compare against each unit's last successful deployment in the target
  environment, not merely the preceding commit or latest PR diff. This includes
  changes from failed, skipped, or superseded runs that have not yet shipped.
- Track the deployed commit and immutable artifact identifier per unit. Update
  that record only after its rollout and verification succeed; never mark a
  partially deployed application as fully updated.
- Fetch the history needed for comparison and account for deleted/renamed files.
  Missing initial state requires an explicit initial provisioning plan.
- Serialize conflicting deployments per unit/environment; an older run cannot
  overwrite a newer successful deployment. Reconcile queued runs with actual
  deployment state before promotion. Never cancel a migration midway for a new push.
- Build/verify selected units, promote their exact artifacts, and run the smoke
  checks relevant to the changed units and their interfaces with unchanged units.
- Order dependent operations, such as an additive migration before new consumers.
  Parallelize only units whose deployment operations are independent.
- Retry failed units and any still-unshipped dependants. Do not redeploy successful
  unrelated units. Rollback uses the prior artifact and compatible dependency
  state for the affected unit; record the actual state after rollback.
- Recovery reruns and rollbacks use the controlled pipeline with an explicit
  revision/artifact and reason. They do not authorize new unreviewed source code
  or routine manual deployments outside the PR-to-main flow.

## Testing

- Test the selector using representative changes: one app, one worker, shared
  dependencies, lockfiles, build config, documentation only, deletion, and rename.
- Verify both selected and skipped units; a no-op must make zero deployment calls.
- Cover multiple merged commits since the last success, a failed prior deployment,
  partial success, unknown paths, missing history, and initial provisioning.
- Verify feature branches/unmerged PRs cannot deploy production, failed required
  checks prevent promotion, and hosting/CI ownership does not produce duplicates.
- Test concurrent runs, stale jobs, unit-scoped retries/rollback, migration order,
  and compatibility between newly deployed and unchanged services in staging.
- Record selection tests, smoke tests, and pipeline checks in `TEST_PLAN.md`.

## Checklist when changing delivery

- [ ] Delivery plan and deployable-unit inventory reviewed before implementation
- [ ] Merge into protected main triggers analysis; exact revision checks gate promotion
- [ ] One deployment owner per unit/environment; hosting triggers configured
- [ ] Selector includes transitive dependencies and all effective build inputs
- [ ] Only affected units deploy; skipped/no-op decisions have visible reasons
- [ ] Last successful deployment tracked separately per unit/environment
- [ ] Ordering, concurrency, partial failure, retries, and rollback documented
- [ ] Selector and staging tests verify positive, negative, and recovery cases

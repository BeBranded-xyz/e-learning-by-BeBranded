---
description: Git workflow, commits, pull requests, code review, and documentation discipline. Project-agnostic. Always applies.
---

# Git Workflow & Documentation

Branch names, deploy triggers, required CI checks, and doc locations are
project-specific — see `PROJECT.md`.

## Branch Strategy

- **`main`**: production, protected, requires PR + review.
- **Integration branch** (optional): `develop` for multi-PR features.
- **Feature branches**: `feature/descriptive-name`.
- **Bug fixes**: `fix/descriptive-name`.
- **Hotfixes**: `hotfix/descriptive-name` (branched from `main`).
- Delete branches after merge. **Never force-push to `main` or a shared branch.**

## Commit Messages

Conventional commits: `type(scope): description`.

Types: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `perf`, `ci`.

Rules:
- **Imperative mood** (`add`, not `added`).
- Subject under 72 characters, no trailing period.
- Body for complex changes.
- **Refactors and features in separate commits.** Never mix structural changes
  with new functionality.

```
feat(catalogue): add full-text search bar
fix(cart): prevent lock extension beyond max
refactor(checkout): extract slot picker into its own component
chore(deps): upgrade auth library to 1.2.x
docs(integrations): document sync safety rules
```

## Pull Requests

**Before opening a PR**:
- The project's check command passes locally (typecheck, lint, unit and
  integration tests); the PR-gate suites in `testing.mdc` are expected green.
- Documentation updated for user-facing or dev-facing changes (mandatory).
- Self-review done; no commented-out code, debug logging, or unused imports.
- No file exceeds 300 lines and no function exceeds 50 lines (excluding
  documented exemptions).
- Rebased on the latest base branch.

**PR description must include**:
- Clear description of changes.
- Link to related issues (`Fixes #123`).
- Testing steps for reviewers.
- Breaking changes, if any.
- The documentation checklist (below).
- Screenshots / recordings for UI changes.

**PR rules**:
- 1 PR = 1 feature or 1 fix. Keep it focused; aim under ~400 changed lines.
- Squash commits on merge if history is noisy.
- Address review comments promptly.

## Documentation Checklist

Every PR description includes this section. A PR cannot merge with unchecked
boxes left unjustified. Adapt the doc targets to the project's actual layout.

```markdown
## Documentation
- [ ] Feature docs created/updated: [list files]
- [ ] Commit messages are release-note quality (CHANGELOG is generated)
- [ ] README.md updated (if structure/config/env changed)
- [ ] Migration changelog updated (if a DB migration is included)
- [ ] Function/endpoint docs + registry updated (if added/changed/removed)
- [ ] PROJECT.md updated (if stack/structure/decision changed)
- [ ] No documentation needed (explain: ___)
```

## Documentation as a Deliverable

**Documentation is not optional; it is part of the change.** A PR that changes
behavior, adds a feature, or modifies configuration includes the matching doc
updates, or it is incomplete.

| Change | Required documentation |
|---|---|
| New feature | Feature doc + feature index (CHANGELOG generated from commits) |
| Feature modification/removal | Update/remove doc, update index |
| New API route / function | Doc or README in the unit + registry entry |
| New environment variable | Add to `.env.example` + deployment docs |
| DB schema change | Migration changelog entry |
| New test category activated / changed tooling | `TEST_PLAN.md` updated |
| Config / deployment change | Update the relevant deployment doc |
| New dependency | Update README prerequisites; justify in the PR |
| UI change | Update the feature doc with the new flow + screenshot |

### Quality rules
- Each doc starts with a `# Title` and a one-paragraph summary.
- Include `Last updated: YYYY-MM-DD` and update it on every edit.
- Code examples must be tested and working — no pseudocode.
- Remove outdated information immediately; mark planned items `> [PLANNED]`.
- Cross-reference related docs with relative links.

### README requirements
The root `README.md`, in order: title + one-line description; tech stack;
prerequisites; getting started (copy-paste ready); project structure (matching
reality); environment variables table; deployment; key architecture decisions.

### Changelog
`CHANGELOG.md` is **generated from conventional commits** by the release tool
declared in `PROJECT.md` (see `releases.mdc`). Never hand-edit it. The commit
message is therefore the changelog entry: write the subject for the reader of
the changelog, and use the body to explain the user-visible effect.

## Code Review

**As author**: respond to all comments; resolve only after addressing; push fixes
rather than force-pushing during review unless asked.

**As reviewer, block PRs that**:
- Add code to files over 300 lines without refactoring, or functions over 50 lines.
- Miss documentation for user-facing changes, or have an incomplete checklist.
- Introduce or preserve commented-out code.
- Have `// TODO` / `// FIXME` without a linked issue.
- Leave debug logging.
- Expose secrets in code or history.
- Bypass authorization, auth, or input validation.
- Modify an already-applied DB migration (a new migration is required instead).

Review within ~24h when possible; be constructive and specific; test critical
changes locally.

## CI

- Monitor workflow runs after every push; fix broken workflows immediately.
- Never disable checks to merge.
- Update workflow files in the same PR as the infrastructure change requiring them.
- The project's required workflows and deploy triggers are listed in `PROJECT.md`.
- A reviewed PR merged into protected `main` triggers production impact analysis.
  Deploy only affected units after their gates pass, per `modules/deployments.mdc`.

## Hotfix Procedure

1. Branch `hotfix/descriptive-name` from `main`.
2. Make the minimal change.
3. Open a PR against `main` with `[HOTFIX]` in the title.
4. You may skip the size guideline if strictly necessary, but never skip the
   documentation checklist or tests.
5. Merge back into the integration branch if one exists.
6. Use a `fix(...)` commit whose body notes `[HOTFIX]` so the generated changelog reflects it.

## Checklist before opening or approving a PR
- [ ] Branch named per convention; rebased on the base branch; no force-push to shared branches
- [ ] Conventional commits, imperative, release-note quality; refactors separate from features
- [ ] Check command green locally; PR-gate suites expected green in CI
- [ ] 1 PR = 1 feature or fix, under ~400 changed lines or justified
- [ ] PR template filled: tests added, verification run, documentation checklist, risk and rollback
- [ ] Screenshots for UI changes (desktop and mobile)
- [ ] Docs, `.env.example`, registries, `PROJECT.md`, `TEST_PLAN.md` updated as needed
- [ ] Reviewer blockers (size, docs, dead code, secrets, authz, applied migrations) all clear

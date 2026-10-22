# Feature Flags Registry

> Every flag in the codebase, with its lifecycle (`modules/releases.mdc`):
> create -> ship dark -> enable gradually -> remove within 30 days of 100%.
> A flag past its removal date blocks the next release. Reviewed monthly.

Last updated: 2026-10-22

## Active

| Flag | Purpose | Created | Default | Rollout state | Owner | Remove by | Issue |
|---|---|---|---|---|---|---|---|
| | None. Unstable APIs use a separate entry point instead (`modules/library-publishing`). | | | | | | |

## Removed

| Flag | Removed on | PR |
|---|---|---|
| | | |

## Conventions

- Names are `snake_case`, verb or noun phrase, no environment in the name.
- Read flags through one typed helper; never string-compare flag names inline.
- Kill switches (operational flags that stay) live in a separate section and
  are documented in the runbook, not here.

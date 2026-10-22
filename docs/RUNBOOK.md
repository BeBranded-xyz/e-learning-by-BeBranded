# Runbook

> Operational procedures for e-learning by BeBranded. Every alert in the error
> tracker or monitoring links to a section here. Updated whenever an incident
> reveals a missing step (`core/maintenance.mdc`).

Last updated: 2026-10-22

## Scope

The module has no production service of its own: host products run it and
own their operations. This runbook covers what the maintainers operate: the
public repository, the npm packages, and the release pipeline.

## Contacts and escalation

| Role | Who | Reach |
|---|---|---|
| Maintainers | BeBranded maintainers | GitHub private vulnerability reporting (Security tab) |

## Procedures

### A secret was committed or pushed
1. **Revoke and rotate it at the provider first.** It is compromised from the
   moment it was pushed, even if the commit is removed.
2. Check provider logs for use of the leaked value.
3. Clean the history only after rotation, through a reviewed procedure (the
   `main` ruleset blocks force pushes; lift it only for that operation).
4. Open a private security advisory if users could be affected.

### A broken or malicious package version was published
1. Publish a fixed patch from CI.
2. `npm deprecate` the bad version with a message pointing to the fix.
3. If the version leaked a secret or contains malicious code, unpublish within
   the registry window, rotate credentials, and publish an advisory.
4. Add the regression test that would have caught it.

### A vulnerability is reported
1. Acknowledge within 3 business days (`SECURITY.md`).
2. Reproduce in a private fork of the advisory; fix with a regression test.
3. Release the fix, then publish the advisory with credit.

## Post-incident

Every incident gets a blameless write-up within 5 working days: timeline, root
cause, what detected it, what did not, action items with owners and dates, and
the regression test that now covers it.

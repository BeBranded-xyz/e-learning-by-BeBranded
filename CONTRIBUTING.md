# Contributing

Thanks for your interest in the project. The module is currently at the specification stage (see [docs/specifications](docs/specifications)).

## Ground rules

- Everything is written in **English**: code, comments, docs, commit messages, issues.
- **This repository is public.** Never commit credentials, tokens, private keys, `.env` files, database dumps, real customer or learner data, or anything that identifies a client project. Use obviously fake values in examples and tests.
- Security vulnerabilities are reported privately. See [SECURITY.md](SECURITY.md).
- New dependencies must use an allowed license (see [Licensing](docs/specifications/08-non-functional-requirements.md#licensing)).

## Before you commit

1. Commit with your GitHub `noreply` email address (`git config user.email "<id>+<login>@users.noreply.github.com"`), so that your personal address is not published.
2. Install [gitleaks](https://github.com/gitleaks/gitleaks) and scan your staged changes:

   ```sh
   gitleaks git --staged --redact
   ```

   To run it automatically, enable the provided hook once:

   ```sh
   git config core.hooksPath .githooks
   ```

CI runs the same scan on the full history of every push and pull request. A finding fails the build.

## If you committed a secret by mistake

Do not just delete it in a new commit: it stays in the history. **Revoke and rotate the secret at its provider first**, then contact the maintainers privately (see [SECURITY.md](SECURITY.md)) so the history can be cleaned.

## Code of conduct

Everyone taking part in this project follows the [code of conduct](CODE_OF_CONDUCT.md).

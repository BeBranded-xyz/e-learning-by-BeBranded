---
description: Shell script rules — bash strict mode, shellcheck/shfmt, quoting, functions, trap cleanup, idempotency, secrets via env, bats-core tests, and when to switch to Python/Go. Apply to every shell script and scripts/ directory.
paths:
  - "**/*.sh"
  - "**/*.bash"
  - "scripts/**"
---

# Shell

## When this applies

Apply to every file matching the globs, plus any executable without an
extension that starts with a shell shebang. Shell is for glue: wiring tools,
CI steps, and local automation. Target interpreter and supported platforms
(Linux, macOS, both) live in `PROJECT.md`. Core dead-code, error, and
observability rules apply; size limits are tighter here (see overrides).

## Toolchain

| Role | Tool | Notes |
|---|---|---|
| Interpreter | `bash` (4+) via `#!/usr/bin/env bash` | Never `sh` unless `PROJECT.md` requires POSIX; then `#!/bin/sh` + `shellcheck -s sh` |
| Version manager | none; bash from the OS or container | Document required minimum in the script header |
| Package manager | none | External tools are checked with `command -v` at startup |
| Formatter | `shfmt -i 2 -ci -bn -sr` | `.editorconfig` carries the same settings |
| Linter | `shellcheck -x -o all` | `.shellcheckrc` at root; no `disable=all` |
| Type checker | none; shellcheck catches most misuse | Strict mode is the substitute |
| Test runner | `bats-core` (+ `bats-support`, `bats-assert`) | Tests in `tests/*.bats` |
| Check command | `make check` | `shfmt -d` + `shellcheck` + `bats` |

- **`# shellcheck disable=SCxxxx` only per line with a reason comment.**
- Scripts are executable (`chmod +x`), have no extension when they are
  commands, and `.sh` when they are sourced libraries.

## Project layout

```
scripts/
  <verb>-<noun>            (executable command, no extension)
  lib/
    log.sh                 (sourced helpers: log, die, require)
    common.sh
tests/
  <verb>-<noun>.bats
  test_helper/             (bats-support, bats-assert as submodules or vendored)
Makefile                   (targets call scripts; never inline long shell in make)
```

- **One script, one job.** A script that needs subcommands is a candidate for
  Python or Go.
- **Sourced libraries never execute anything** at load time and never call
  `exit`; they define functions only.

## Naming conventions

| Item | Convention | Example |
|---|---|---|
| Script files | `kebab-case`, verb first | `deploy-worker`, `rotate-logs` |
| Library files | `kebab-case.sh` | `lib/log.sh` |
| Functions | `snake_case`; library functions prefixed | `log::info`, `deploy_check_prereqs` |
| Local variables | `snake_case`, always `local` | `local target_dir` |
| Script-level constants | `readonly UPPER_SNAKE_CASE` | `readonly MAX_RETRIES=3` |
| Environment inputs | `UPPER_SNAKE_CASE`, documented in header | `DEPLOY_ENV` |
| Exit code constants | `readonly EX_*` (sysexits) | `readonly EX_USAGE=64` |
| Test files | `<script>.bats` | `deploy-worker.bats` |

## Language idioms and rules

### Header and strict mode
Every script starts exactly like this:

```bash
#!/usr/bin/env bash
# deploy-worker: build and deploy one worker to the target environment.
# Usage: deploy-worker [-e ENV] [-n] NAME
# Env:   DEPLOY_TOKEN (required), DEPLOY_ENV (default: staging)
set -euo pipefail
IFS=$'\n\t'
```

- **`set -euo pipefail` and a restricted `IFS`** are mandatory. Never
  `set +e` for a block; use `if cmd; then` or `cmd || handle`.
- **Never rely on `set -e` inside functions called in conditionals**; test
  return values explicitly.
- **`shopt -s inherit_errexit nullglob`** when globbing or using command
  substitution in `bash` 4.4+.

### Structure
- **Everything lives in functions; the last line is `main "$@"`.** Top level
  holds only the header, `set` options, constants, and `main`.
- **`main` parses arguments, validates, then delegates**; it stays under 50
  lines like any function.
- **Prerequisites checked up front**: `require_cmd jq curl` before any work;
  fail with a clear message and `EX_UNAVAILABLE` (69).
- **`usage()` prints to stderr and exits 64** on bad arguments or `-h`.
- **Argument parsing with `getopts`** for flags; long options only through a
  `while case` loop with explicit `--` handling. Positional args validated
  by count.

### Quoting and tests
- **Quote every expansion**: `"$var"`, `"${arr[@]}"`, `"$(cmd)"`. The only
  unquoted expansions are deliberate word splits with a comment.
- **`[[ ]]` for tests, `(( ))` for arithmetic**; never `[ ]` or `test`.
- **`$(...)` never backticks**; `${var:?message}` for required variables;
  `${var:-default}` for optional ones.
- **Arrays for lists**, never space-separated strings; iterate with
  `"${items[@]}"`.
- **`printf` over `echo`** for anything with variables or escapes.
- **Paths**: derive the script dir once
  (`script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)`), use
  `--` before paths, and `mktemp -d` for temp files.

### Errors, cleanup, exit codes
- **`trap cleanup EXIT`** registered before creating anything temporary;
  `cleanup` removes temp dirs, kills background jobs, and restores state. It
  must be safe to run twice.
- **`die "message" [code]`** helper writes to stderr and exits; never a bare
  `exit 1` in the middle of logic.
- **Exit codes follow sysexits** (`0` success, `64` usage, `69` missing
  dependency, `70` internal error, `75` temp failure/retryable, `77` permission).
- **Logs go to stderr, data to stdout**, so output can be piped. Log lines
  carry a level and a timestamp; no secrets, no PII.
- **Pipelines**: `pipefail` is on; check `PIPESTATUS` when a middle stage
  matters; never `cmd | while read` when the loop must modify outer variables
  (use `while read ...; done < <(cmd)`).

### Idempotency and safety
- **Every script is safe to re-run**: `mkdir -p`, `ln -sfn`, check before
  create, `rsync` over `cp -r`, and no appends without a marker check.
- **Destructive actions need `--yes`/`-y` or a dry-run default** (`-n` prints
  what would happen). Never `rm -rf` on an unvalidated variable:
  `rm -rf -- "${build_dir:?}/"`.
- **No `curl | bash`**, in scripts or docs. Download to a file, verify a
  checksum or signature, then execute.
- **Never `cd` without checking**; prefer `cd -- "$dir" || die` or
  subshells `( cd ... && ... )`.
- **Background jobs are tracked** (`pids+=("$!")`) and waited on; `wait "$pid"`
  return codes are checked.

### When to stop using shell
Switch to Python (`uv run script.py`) or Go when any of these holds:
- the script exceeds ~100 lines of logic or needs more than three functions
  beyond `main`, `usage`, and `cleanup`;
- it needs data structures beyond flat arrays (maps of lists, JSON
  manipulation beyond a single `jq` filter, dates, floats);
- it needs error handling with retries, partial rollback, or concurrency;
- it must run on Windows without WSL, or be unit-tested at function level.

### Forbidden
- `eval` on user input, `sudo` inside scripts, hardcoded absolute home paths,
  `ls` parsing, `cat file | grep` chains, `which` (use `command -v`),
  `alias` in scripts, `export` of secrets, `set +u` workarounds, unquoted
  `$@`, `#!/bin/bash`.

## Size limit overrides for shell

| Scope | Limit | Reason |
|---|---|---|
| Script file | 150 lines | Beyond this, shell loses testability; move to Python/Go |
| Function | 30 lines | Shell has no types; short functions are the only safety net |

Nesting (3) and parameter (4, via positional args) limits apply unchanged.

## Dependencies

- **External tools are declared in the header and checked at start** with
  `require_cmd`; pinned versions live in the container image or `PROJECT.md`.
- **No package installation from a script** except a dedicated
  `bootstrap`/`setup` script that is idempotent and prints what it changes.
- **Vendored bats helpers** are git submodules or copied with their licence.
- **Audit**: `shellcheck` in CI; downloaded binaries verified by checksum.

## Testing

Tests live in `tests/*.bats` and run with `bats -r tests/`.

| Category | Tool | Rule |
|---|---|---|
| Unit (functions) | `bats-core` sourcing `lib/*.sh` | Every library function; assert output and status |
| CLI / integration | `bats-core` running the script in a temp dir | Every script: happy path, usage error, missing dependency, dry-run |
| Idempotency | `bats-core`, run twice, compare state | Every script that changes the filesystem or a remote |
| Static | `shellcheck -o all`, `shfmt -d` | In `make check` |
| Cross-platform | CI matrix (Linux + macOS) | When `PROJECT.md` lists both |
| Security | `shellcheck` SC2086/SC2091 family + review of `rm`/`eval`/`sudo` | Every PR |

- **Mock external commands with PATH shims** (`tests/stubs/curl` writing
  received args to a file); never hit the network or a real remote.
- **Isolate with `BATS_TEST_TMPDIR`**; every test sets `HOME`/`XDG_*` to it.
- Use `setup()`/`teardown()`; `run --separate-stderr` to assert stderr logs.

## Security specifics

- **Secrets come from environment variables or a file with mode 600**, never
  from arguments (visible in `ps`) or embedded in the script. Read once into a
  local, never `export` further, never `set -x` while set.
- **`set -x` only behind a `DEBUG` variable** and never in CI logs containing
  secrets.
- **Validate inputs**: whitelist characters for names used in paths or
  commands; reject `..` and leading `-`.
- **Temp files via `mktemp`** with `umask 077`; never predictable names in `/tmp`.
- **Never build commands from strings**; use arrays: `cmd=(rsync -a -- "$src" "$dst"); "${cmd[@]}"`.
- **Verify downloads** (sha256 or signature) before use; pin URLs to tags.

## Checklist when touching shell code

- [ ] `#!/usr/bin/env bash`, `set -euo pipefail`, restricted `IFS`, header with usage and env
- [ ] `shellcheck -o all` and `shfmt -d` clean; disables have a reason
- [ ] Functions only, `main "$@"` last; `main` under 50 lines, file under 150
- [ ] Every expansion quoted; `[[ ]]`; arrays for lists; `printf` over `echo`
- [ ] `trap cleanup EXIT` set before temp resources; cleanup is re-runnable
- [ ] Prerequisites checked; usage on bad args; sysexits codes
- [ ] Script is idempotent; destructive actions gated by `--yes` or dry-run
- [ ] No `curl | bash`; downloads verified
- [ ] Secrets via env, never args; no `set -x` with secrets
- [ ] `bats` tests cover happy path, errors, idempotency; external commands stubbed
- [ ] Under ~100 lines of logic, otherwise moved to Python/Go

---
description: Rust rules — rustfmt, clippy -D warnings, thiserror/anyhow, no unwrap, unsafe policy, tokio, workspaces, cargo-deny/audit/nextest, proptest, fuzz, criterion, miri, loom. Apply to every Rust file and Cargo.toml.
paths:
  - "**/*.rs"
  - "Cargo.toml"
---

# Rust

## When this applies

Apply to every file matching the globs. The toolchain channel, MSRV, async
runtime, and target platforms live in `PROJECT.md`. Core size limits,
dead-code, error, and observability rules apply unless overridden below.

## Toolchain

| Role | Tool | Notes |
|---|---|---|
| Version manager | `rustup` + `rust-toolchain.toml` | Channel and components pinned in the repo |
| Package manager | `cargo` | `Cargo.lock` committed for binaries and workspaces |
| Formatter | `rustfmt` (`cargo fmt --all --check`) | `rustfmt.toml` at root; no manual layout |
| Linter | `clippy` (`cargo clippy --all-targets --all-features -- -D warnings`) | Lints configured in `Cargo.toml` `[lints]` |
| Type checker | `rustc` (`cargo check`) | `#![deny(missing_docs)]` on library crates |
| Test runner | `cargo nextest run` | Falls back to `cargo test` for doctests |
| Check command | `cargo make check` (or `just check`) | fmt + clippy + nextest + doctests + deny |

- **`edition` is pinned in every `Cargo.toml`** (`edition = "2021"` or newer per
  `PROJECT.md`); `rust-version` (MSRV) set on library crates.
- **Workspace-level `[workspace.lints]`** with `clippy::pedantic` enabled and
  specific pedantic lints allowed with a reason; `unsafe_code = "forbid"` on
  every crate that does not need it.
- **`#[allow(...)]` requires a comment** and is scoped to the item, never the crate.

## Project layout

```
Cargo.toml                (workspace root: members, shared deps, lints)
Cargo.lock
rust-toolchain.toml  rustfmt.toml  deny.toml  Makefile.toml
crates/
  <name>-core/            (domain types + logic, no I/O, no async)
  <name>-api/             (HTTP/RPC adapters)
  <name>-cli/             (binary: src/main.rs is wiring only)
  <name>/src/
    lib.rs                (module tree + re-exports only)
    error.rs              (crate Error enum via thiserror)
    <module>/mod.rs or <module>.rs
tests/                    (integration tests per crate)
benches/                  (criterion)
fuzz/                     (cargo-fuzz targets)
```

- **Workspace from day one**; one crate per deployable or per reusable layer.
- **Binaries are thin**: `main.rs` parses args (`clap`), builds config, calls
  `run() -> anyhow::Result<()>`.
- **`lib.rs` and `mod.rs` contain no logic**, only `mod`, `pub use`, and docs.

## Naming conventions

| Item | Convention | Example |
|---|---|---|
| Crates | `kebab-case`, prefixed by project | `shop-core` |
| Modules / files | `snake_case` | `rate_limiter.rs` |
| Types / traits / enums / variants | `PascalCase` | `OrderStatus::Shipped` |
| Functions / methods / variables | `snake_case` | `lock_product` |
| Constants / statics | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| Lifetimes | short, lowercase | `'a`, `'conn` |
| Type parameters | single capital or `PascalCase` | `T`, `Repo` |
| Conversion methods | `as_` (cheap ref), `to_` (copy), `into_` (consume) | `to_string`, `into_inner` |
| Constructors | `new`, `with_<field>`, `from_<source>` | `Order::with_items(...)` |
| Feature flags | `kebab-case`, additive | `postgres`, `tls-rustls` |
| Test functions | `snake_case` describing behaviour | `parse_rejects_empty_id` |

## Language idioms and rules

### Errors
- **Library crates: `thiserror` enums**, one `Error` per crate, variants named
  by cause, each carrying a machine-readable `code()`; `#[from]` only for
  wrappers that lose no context, otherwise `#[source]` plus a field.
- **Binary crates only: `anyhow`** with `.context("what was attempted")` on
  every `?` that crosses a meaningful boundary.
- **No `unwrap()` / `expect()` outside tests and `const` contexts.** The rare
  infallible case uses `expect("invariant: <why it cannot fail>")` and the
  reviewer verifies the invariant; `clippy::unwrap_used` and `expect_used`
  are `deny` on non-test code.
- **`?` everywhere; never `match` on `Result` just to re-wrap.**
- **Never `panic!` in library code on caller input**; return `Err`.

```rust
#[derive(Debug, thiserror::Error)]
pub enum OrderError {
    #[error("order {0} not found")]
    NotFound(OrderId),
    #[error("repository failure")]
    Repository(#[source] RepoError),
}

impl OrderError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "order_not_found",
            Self::Repository(_) => "order_repository",
        }
    }
}
```

### Ownership and borrowing
- **Take `&T` / `&str` / `&[T]` in parameters**; take ownership only when the
  function stores or consumes the value. Return owned values.
- **No `.clone()` to silence the borrow checker**; restructure lifetimes or
  use `Rc`/`Arc` deliberately with a comment. `clippy::redundant_clone` denies.
- **Newtypes for identifiers and units** (`struct OrderId(Uuid)`), never bare
  `String`/`u64` in public signatures.
- **Make invalid states unrepresentable**: enums over boolean flags, builder
  or typestate for multi-step construction.
- **Immutability by default**: `let` over `let mut`; mutate through small,
  named methods.

### Unsafe
- **`unsafe` is forbidden** (`#![forbid(unsafe_code)]`) unless `PROJECT.md`
  lists the crate as FFI/performance-critical.
- **Every `unsafe` block carries a `// SAFETY:` comment** stating the
  invariants that make it sound, is as small as possible, is wrapped in a safe
  API, and requires a second reviewer.
- **`cargo miri test` runs on every crate containing `unsafe`.**

### Async (tokio)
- **One runtime**, started in `main` via `#[tokio::main]`; libraries never
  spawn their own runtime.
- **No blocking in async**: no `std::fs`, `std::thread::sleep`, sync DB
  clients, or CPU-heavy loops in a task; use `tokio::task::spawn_blocking`.
- **Every spawned task is owned**: its `JoinHandle` is awaited or it is in a
  `JoinSet`; cancellation via `CancellationToken`, never by dropping silently.
- **`tokio::time::timeout` on every await that leaves the process.**
- **No `std::sync::Mutex` held across an `.await`**; use `tokio::sync` types
  or restructure. Never `Mutex<Vec<...>>` as a queue; use channels.

### Feature flags
- **Additive only**: enabling a feature must never break another.
- **No default features that pull heavy deps**; `default = []` for libraries.
- CI builds with `--no-default-features`, `--all-features`, and each
  feature alone (`cargo hack`).

### Forbidden
- `unwrap`/`expect` in non-test code, `std::process::exit` outside `main`,
  `static mut`, `mem::transmute` without `SAFETY`, `println!` for logging
  (use `tracing` with structured fields, no PII), `#[allow(clippy::all)]`,
  `unsafe impl Send/Sync` without loom or a proof.

## Size limit overrides for Rust

| Scope | Limit | Reason |
|---|---|---|
| Module holding one type and its `impl` blocks | 500 lines | Splitting a single type across files harms readability |
| Test module (`#[cfg(test)]`) | 400 lines | Table-like cases are flat data |
| Generated (`build.rs`, `prost`, `bindgen`) | exempt | Marked generated |

Function (50), nesting (3), parameters (4), and complexity (10) limits apply
unchanged; a `match` with many small arms counts as one branch per arm.

## Dependencies

- **Add with `cargo add <crate>`** (`--dev`, `--features`); commit `Cargo.lock`
  in the same change. Pin with caret ranges (`"1.4"`), never `"*"`.
- **`cargo deny check`** (`deny.toml`: licences, bans, advisories, duplicate
  versions) and **`cargo audit`** in `cargo make check` and CI.

## Testing

Unit tests sit in `#[cfg(test)] mod tests` next to the code; integration
tests in `tests/`; run with `cargo nextest run --all-features` plus
`cargo test --doc`.

| Category | Tool | Rule |
|---|---|---|
| Unit | `#[test]` + `assert_eq!` / `pretty_assertions` | Every public function; doctests on public APIs |
| Property-based | `proptest` (or `quickcheck`) | Parsers, serialisers, arithmetic, invariants; regressions committed |
| Fuzz | `cargo fuzz run <target>` | Every parser / decoder has a target in `fuzz/`; corpus committed |
| Concurrency | `loom` for lock-free or custom sync primitives | Mandatory where `unsafe` or atomics are used |
| Unsafe soundness | `cargo miri test` | Every crate with `unsafe` |
| Integration | `tests/` + `testcontainers` | Real DB/queue; never mock SQL |
| Contract | `insta` snapshots + `wiremock` | Every external API wrapper |
| Benchmarks | `criterion` in `benches/` | Hot paths from `PROJECT.md`; regression threshold in CI |
| Security | `cargo audit`, `cargo deny` | In `cargo make check` |

- **Mock only at boundaries** via traits (`mockall` or a hand-written fake);
  never mock internal modules.
- **Inject the clock** (`tokio::time::pause()` in async tests) and randomness.
- **Async tests use `#[tokio::test]`**; never a blocking runtime inside a test.

## Security specifics

- **Validate external input at the edge** with typed parsing (`serde` with
  `#[serde(deny_unknown_fields)]`, newtypes with `TryFrom`).
- **Secrets from env or a secret manager**, wrapped in `secrecy::SecretString`;
  never `Debug`-printed, never in CLI args.
- **SQL through parameterised queries** (`sqlx::query!` or equivalent);
  never `format!` into SQL.
- **`std::process::Command` with argument lists**, never a shell string.
- **TLS via `rustls`**; never `danger_accept_invalid_certs` outside tests.
- **Constant-time comparison** (`subtle`) for secrets; `rand::rngs::OsRng` for tokens.

## Checklist when touching Rust code

- [ ] `cargo fmt --check` and `clippy -D warnings` clean; every `allow` has a reason
- [ ] `edition` and `rust-version` pinned; toolchain file present
- [ ] `thiserror` in libraries, `anyhow` only in binaries; errors carry a code
- [ ] No `unwrap`/`expect` outside tests; any exception documented
- [ ] No `unsafe` without `// SAFETY:` and a second review; miri passes
- [ ] No blocking calls in async; tasks owned; timeouts on outbound awaits
- [ ] Newtypes for ids/units; borrow by default; no reflexive `clone()`
- [ ] Files within limits (500 only for single-type modules), functions under 50
- [ ] Unit + proptest added; fuzz target for any new parser; loom where relevant
- [ ] `criterion` bench for hot paths; no regression
- [ ] `cargo deny` and `cargo audit` clean; `Cargo.lock` updated
- [ ] `tracing` structured logs, no PII, no `println!`

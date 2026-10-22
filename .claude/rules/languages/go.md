---
description: Go rules — gofmt/goimports, golangci-lint, error wrapping, context propagation, goroutine hygiene, table-driven tests, race/fuzz/bench, govulncheck. Apply to every Go file and go.mod.
paths:
  - "**/*.go"
  - "go.mod"
---

# Go

## When this applies

Apply to every file matching the globs. The Go version, module path, and the
frameworks in use (HTTP router, ORM, RPC) live in `PROJECT.md`. Core size
limits, dead-code, error, and observability rules apply unless overridden below.

## Toolchain

| Role | Tool | Notes |
|---|---|---|
| Version manager | `go` directive in `go.mod` + toolchain line | The `go` tool downloads the pinned toolchain |
| Package manager | Go modules | `go get`, `go mod tidy`; `go.sum` committed |
| Formatter | `gofmt` + `goimports` (`-local <module>`) | Non-negotiable; CI fails on diff |
| Linter | `golangci-lint` | Config in `.golangci.yml` at repo root |
| Type checker | `go vet` + `staticcheck` | Both run inside golangci-lint |
| Test runner | `go test ./... -race -shuffle=on` | Coverage via `-coverprofile` |
| Check command | `make check` | fmt check + `golangci-lint run` + `go test -race` + `govulncheck` |

- **Minimum linters enabled**: `errcheck, govet, staticcheck, gosimple, unused,
  ineffassign, errorlint, gocritic, gosec, revive, bodyclose, noctx, contextcheck,
  gocyclo (10), funlen (50), nestif (3), exhaustive, prealloc, sqlclosecheck`.
- **`//nolint:<linter> // reason`** only; never a bare `//nolint`.

## Project layout

```
go.mod / go.sum
cmd/<binary>/main.go        (wiring only: flags, config, DI, run)
internal/                   (private packages; the bulk of the code)
  <domain>/
    <domain>.go             (types + interfaces)
    service.go              (business logic)
    repository.go           (data access)
    errors.go               (sentinel + typed errors)
    <domain>_test.go
pkg/                        (only what external modules may import; often absent)
api/                        (OpenAPI, protobuf definitions)
testdata/                   (golden files, fixtures; ignored by the compiler)
Makefile  .golangci.yml
```

- **`internal/` by default.** Promote to `pkg/` only with a documented consumer.
- **`main.go` is under 50 lines** and calls `run(ctx, args, stdout) error`
  so it can be tested.
- **One package per directory, package name equals directory name**, no
  `util`, `common`, `helpers`, or `misc` packages.

## Naming conventions

| Item | Convention | Example |
|---|---|---|
| Packages | short, lowercase, singular, no underscores | `order`, `httpx` |
| Files | `snake_case.go`, `_test.go` suffix | `rate_limiter.go` |
| Exported identifiers | `PascalCase`, no package stutter | `order.Service`, not `order.OrderService` |
| Unexported identifiers | `camelCase` | `parseRow` |
| Interfaces | verb + `er` for single-method; noun otherwise | `Reader`, `Repository` |
| Constructors | `New` / `New<Type>` | `NewService(repo Repository)` |
| Errors (sentinel) | `Err<Reason>` | `ErrNotFound` |
| Errors (typed) | `<Reason>Error` struct | `ValidationError` |
| Acronyms | all caps | `userID`, `HTTPClient` |
| Receivers | 1 to 2 letters, consistent per type | `func (s *Service)` |
| Context parameter | first, named `ctx` | `func Do(ctx context.Context, ...)` |

## Language idioms and rules

### Errors
- **Every error is handled or returned; never `_ = err`.** `errcheck` enforces it.
- **Wrap with context using `%w`**: `fmt.Errorf("load order %s: %w", id, err)`.
  One `%w` per wrap; message says what was attempted, not "error" or "failed".
- **Sentinel errors for expected states** (`ErrNotFound`), **typed errors when
  callers need data** (`*ValidationError{Field, Code}`); every exported error
  carries a machine-readable `Code() string`.
- **Callers inspect with `errors.Is` / `errors.As`**, never string comparison.
- **No `panic` outside `main`/`init` for unrecoverable startup failures**; a
  library never panics on caller input.
- **Errors are logged once**, at the boundary that handles them, with the full
  chain; inner layers only wrap and return.

```go
var ErrNotFound = errors.New("order: not found")

type ValidationError struct {
    Field string
    Code  string
}

func (e *ValidationError) Error() string { return "validation: " + e.Field + ": " + e.Code }

func (s *Service) Get(ctx context.Context, id ID) (Order, error) {
    o, err := s.repo.Get(ctx, id)
    if err != nil {
        return Order{}, fmt.Errorf("get order %s: %w", id, err)
    }
    return o, nil
}
```

### Context
- **`ctx context.Context` is the first parameter** of every function that
  does I/O, blocks, or calls something that does. Never store it in a struct.
- **Never `context.Background()` outside `main`, tests, or a documented
  detached-work path**; derive from the caller.
- **Every outbound call has a deadline**: `context.WithTimeout` at the caller,
  `defer cancel()` immediately after.
- **Context values carry request-scoped metadata only** (request id, principal);
  never dependencies or optional parameters.

### Concurrency
- **Every goroutine has a known exit**: it selects on `ctx.Done()`, its channel
  is closed by the owner, or it is joined via `errgroup`/`sync.WaitGroup`. No
  goroutine leaks; `goleak` verifies in tests.
- **Prefer `errgroup.WithContext`** over hand-rolled WaitGroup + error channel.
- **The sender closes the channel**; receivers never close.
- **Protect shared state** with `sync.Mutex` held for the shortest scope, or
  avoid sharing by design (channels, immutable values). No `sync/atomic` tricks
  without a comment stating the invariant.
- **`go test -race` on every run**; a race is a failing build.

### Types, nullability, immutability
- **Accept interfaces, return structs.** Define interfaces at the consumer,
  keep them to 1 to 3 methods.
- **Zero values must be usable** or the constructor must be the only way in.
- **Pointers signal mutation or absence**; use value receivers for small
  immutable types and pointer receivers consistently otherwise.
- **No naked returns; no named results** except for `defer`-modified errors.
- **Enums via typed constants + `iota`** with a `String()` method and
  `exhaustive` switch checks.

### Resources
- **`defer Close()` right after a successful open**, and check the error of
  `Close` on writers.
- **HTTP**: never the default client; set timeouts, always `defer resp.Body.Close()`,
  drain the body on reuse.

### Forbidden
- `init()` with side effects, package-level mutable variables, `interface{}`/`any`
  in public APIs without a generic alternative considered, reflection in hot
  paths, `time.Sleep` for synchronisation, `log.Fatal` outside `main`,
  `fmt.Println` for logging (use `log/slog` with structured attrs, no PII).

## Size limit overrides for Go

| Scope | Limit | Reason |
|---|---|---|
| Table-driven test file | 500 lines | Tables are flat data, not logic |
| Generated code (`*.pb.go`, mocks, `stringer`) | exempt | Marked `// Code generated ... DO NOT EDIT.` |

All other core limits apply; `funlen`, `gocyclo`, and `nestif` enforce them.

## Dependencies

- **Add with `go get <module>@<version>`** then `go mod tidy`; commit `go.mod`
  and `go.sum` together. Never edit `go.sum` by hand.
- **Prefer the standard library**; a dependency must earn its place (review
  activity, licence, transitive weight with `go mod graph`).
- **`govulncheck ./...`** in `make check` and CI; a reachable vulnerability
  fails the build.

## Testing

Tests live next to the code (`_test.go`, same package for white-box, `_test`
suffix package for black-box). Run: `go test ./... -race -shuffle=on -cover`.

| Category | Tool | Rule |
|---|---|---|
| Unit | `testing` + table-driven `t.Run` | Every exported function; `t.Parallel()` where safe |
| Assertions | `testify` (optional) or plain `if got != want` | One style per repo; `cmp.Diff` for structs |
| Property-based | `testing/quick` or `pgregory.net/rapid` | Encoders, parsers, invariants |
| Fuzz | `go test -fuzz=Fuzz<Name>` | Every parser and input boundary has a `Fuzz*` target; corpus committed |
| Concurrency | `-race`, `goleak.VerifyNone` | Every package that starts goroutines |
| Integration | `//go:build integration` + `testcontainers-go` | Real DB/queue; never mock SQL |
| Contract | golden files in `testdata/` + `httptest` | Every external API wrapper |
| Benchmarks | `Benchmark*` + `benchstat` | Hot paths listed in `PROJECT.md`; regressions block merge |
| Security | `gosec` (in golangci-lint), `govulncheck` | In `make check` |

- **Mock only at boundaries** via the consumer-defined interface; generate
  with `mockery`/`moq` or write a tiny fake. Never mock the standard library.
- **Inject the clock and randomness** (`func() time.Time`, `rand.Source`).
- **`t.Helper()` in every helper; `t.Cleanup` over manual teardown.**

## Security specifics

- **Validate all external input** at handlers with explicit checks or a
  schema library; decode JSON with `DisallowUnknownFields`.
- **SQL only through placeholders**; never `fmt.Sprintf` into a query.
- **`os/exec` with argument slices**, never a shell; validate paths against
  a root (`filepath.IsLocal`, `os.Root` when available).
- **Secrets from env or a secret manager**, read once at startup into a config
  struct; never logged, never in flags.
- **TLS defaults**: `MinVersion: tls.VersionTLS12`; never `InsecureSkipVerify`
  outside a test.
- **`crypto/rand` for tokens**, constant-time compares for secrets
  (`subtle.ConstantTimeCompare`).
- `gosec` findings are fixed or annotated `//nolint:gosec // reason`.

## Checklist when touching Go code

- [ ] `gofmt`/`goimports` clean; `golangci-lint run` passes with no bare `nolint`
- [ ] Every error handled or wrapped with `%w`; sentinel/typed errors used
- [ ] `ctx` first parameter; deadlines on outbound calls; no stored contexts
- [ ] Every goroutine has an owner and an exit; `-race` and `goleak` pass
- [ ] Interfaces defined at the consumer; structs returned
- [ ] `defer Close()` on every resource; HTTP client has timeouts
- [ ] File under 300 lines, functions under 50, nesting under 3
- [ ] Table-driven tests added; fuzz target for any new parser
- [ ] Benchmarks for hot paths; `benchstat` shows no regression
- [ ] `go mod tidy` run; `govulncheck` and `gosec` clean
- [ ] `slog` structured logging, no PII, no `fmt.Println`

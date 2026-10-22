---
description: Python rules — uv, ruff, strict typing, pydantic at boundaries, src layout, pytest/hypothesis, security tooling. Apply to every Python file and pyproject.toml.
paths:
  - "**/*.py"
  - "pyproject.toml"
---

# Python

## When this applies

Apply to every file matching the globs. Framework specifics (Django, FastAPI,
Flask, data tooling) and the supported Python version live in `PROJECT.md`.
The core size limits, dead-code rules, and error/observability rules apply
unchanged unless overridden below.

## Toolchain

| Role | Tool | Notes |
|---|---|---|
| Version manager | `uv python` | `.python-version` committed; one version per repo |
| Package manager | `uv` | `uv add`, `uv sync`, `uv run`; never `pip install` by hand |
| Formatter | `ruff format` | Replaces black; no other formatter |
| Linter | `ruff check` | Rule sets enabled in `pyproject.toml` (see below) |
| Type checker | `pyright` (strict) or `mypy --strict` | Pick one per project in `PROJECT.md` |
| Test runner | `pytest` | With `pytest-xdist`, `pytest-cov`, `hypothesis` |
| Check command | `make check` (or `uv run poe check`) | Runs format check + lint + typecheck + tests |

- **All config lives in `pyproject.toml`** (`[tool.ruff]`, `[tool.pyright]`,
  `[tool.pytest.ini_options]`, `[tool.coverage]`). No `setup.cfg`, no `tox.ini`.
- **Minimum ruff selection**: `E, W, F, I, N, UP, B, S, A, C4, SIM, RUF, PTH, PL`
  plus `D` when the project documents public APIs. Never blanket-ignore a rule
  set; per-line `# noqa: CODE` with a reason only.
- **Type checker in strict mode** and run on the whole `src/` tree; `tests/` may
  relax `reportPrivateUsage` only.
- **Pre-commit** runs `ruff format --check`, `ruff check`, and the type checker;
  CI runs the same `make check` as local.

## Project layout

```
pyproject.toml
uv.lock
.python-version
src/<package>/
  __init__.py          (public API re-exports only)
  py.typed
  <domain>/            (one package per bounded concern)
    models.py          (pydantic / dataclasses)
    service.py         (business logic, pure where possible)
    repository.py      (data access)
    errors.py          (typed exceptions for this domain)
tests/
  unit/
  integration/
  conftest.py
scripts/               (one-off CLIs, thin wrappers around src/)
```

- **Always the `src/` layout.** Tests import the installed package, never the
  working directory, so `uv sync` catches packaging mistakes.
- **No logic in `__init__.py`** beyond re-exports and `__all__`.
- **Entry points are declared** in `[project.scripts]`, not `if __name__ == "__main__":`
  blocks scattered across modules (one `__main__.py` per package is fine).

## Naming conventions

| Item | Convention | Example |
|---|---|---|
| Modules / packages | `snake_case`, short, no plurals for packages | `order_service.py` |
| Classes / exceptions | `PascalCase`; exceptions end in `Error` | `OrderNotFoundError` |
| Functions / variables | `snake_case` | `lock_product` |
| Constants | `UPPER_SNAKE_CASE` at module level | `MAX_RETRIES` |
| Private members | single leading underscore | `_parse_row` |
| Type aliases / TypeVars | `PascalCase` / `T`, `T_co` | `OrderId = NewType("OrderId", str)` |
| Protocols | `PascalCase`, no `I` prefix, often `-able` | `Repository`, `Closeable` |
| Test files / functions | `test_<module>.py` / `test_<behaviour>` | `test_orders_service.py` |
| Fixtures | `snake_case` noun | `db_session` |

## Language idioms and rules

### Typing
- **Every function signature is fully annotated**, including `-> None`. Locals
  are inferred; annotate only when the checker cannot.
- **No `Any`.** Use `object` and narrow with `isinstance`/`TypeGuard`, or a
  `TypeVar`/`Protocol`. `Any` requires an inline `# type: ignore[...]`-style
  justification comment and is limited to third-party boundaries.
- **Structural typing via `Protocol`** for dependencies (repositories, clients);
  inject them, never import concrete implementations into business logic.
- **`NewType` for identifiers** (`UserId`, `OrderId`); never pass bare `str`
  ids between layers.
- **`TypedDict` only for external JSON shapes**; internal data uses
  dataclasses or pydantic.
- Use modern syntax: `list[str]`, `X | None`, `Self`, `TypeAlias`/`type`
  statements. Never `Optional[...]`, `typing.List`, or `Union`.

### Data models
- **Pydantic at boundaries** (HTTP, CLI args, config, queue messages, files):
  `BaseModel` with `model_config = ConfigDict(frozen=True, extra="forbid")`.
  Validate once at the edge; inner layers receive already-valid objects.
- **`@dataclass(frozen=True, slots=True)`** (or `attrs`) for internal value
  objects and domain entities; never pydantic in hot inner loops.
- **Immutability by default**: frozen dataclasses, `tuple` over `list` for
  fixed sequences, `Mapping` over `dict` in signatures, `Final` for constants.
- **No mutable default arguments**; ruff `B006` enforces it.

### Errors
- **One exception hierarchy per package** rooted in `<Package>Error(Exception)`;
  every exception carries a machine-readable `code: str` attribute.
- **Never a bare `except:` or `except Exception:` that swallows.** Catch the
  narrowest type; re-raise with `raise NewError(...) from exc` to keep the chain.
- **Never return `None` to signal failure** from a function that normally
  returns a value; raise, or return an explicit result type.
- **Never use exceptions for control flow** across layers; `KeyError`/`StopIteration`
  handling stays local.

```python
class PaymentError(AppError):
    code = "payment_failed"

def charge(order: Order, gateway: Gateway) -> Receipt:
    try:
        return gateway.charge(order.total)
    except GatewayTimeout as exc:
        raise PaymentError(f"gateway timeout for {order.id}") from exc
```

### Resources and I/O
- **`pathlib.Path` everywhere**; never `os.path`, never string concatenation
  for paths. Accept `Path | str` only at CLI boundaries and convert immediately.
- **Context managers for every resource** (files, sockets, DB sessions, locks).
  Implement `__enter__/__exit__` or `contextlib.contextmanager` for your own.
- **Explicit encodings**: `open(path, encoding="utf-8")` always.
- **Logging via `logging.getLogger(__name__)`** with structured extras; never
  `print` outside CLI output code. No PII in log fields.

### Async
- **Never mix sync blocking calls into async code**: no `time.sleep`, `requests`,
  or sync DB drivers inside `async def`. Use `asyncio.to_thread` for unavoidable
  blocking work.
- **Structured concurrency**: `asyncio.TaskGroup` (or `anyio`) instead of
  fire-and-forget `create_task`; every task has an owner that awaits it.
- **Timeouts on every await that leaves the process** (`asyncio.timeout`).
- **Do not create event loops manually**; a single `asyncio.run(main())` entry.

### Forbidden
- `eval`, `exec`, `pickle` on untrusted data, `subprocess` with `shell=True`,
  `assert` for runtime validation, star imports, module-level side effects,
  global mutable state, `__del__` for cleanup, `# type: ignore` without a code.

## Size limit overrides for Python

| Scope | Limit | Reason |
|---|---|---|
| Pydantic model module | 200 lines | Boundary schemas grow by field, not by logic |
| Test file | 400 lines | Parametrised cases are verbose but flat |

All other core limits (300/50/3/4/10) apply unchanged.

## Dependencies

- **Add with `uv add <pkg>`** (`--dev` for tooling); commit `uv.lock` in the
  same change. Never edit `pyproject.toml` dependency lists by hand.
- **Pin the upper bound loosely** (`>=1.4,<2`), never `==` in libraries; the
  lockfile pins for applications.
- **Audit** with `uv run pip-audit` (or `uv audit` when available) in CI;
  fail on any known vulnerability without a documented exception.
- Prefer typed packages (`py.typed`); check licences before adding.

## Testing

Tests live in `tests/`, mirror the `src/` package path, and run with
`uv run pytest -n auto --cov=src --cov-fail-under=<PROJECT.md threshold>`.

| Category | Tool | Rule |
|---|---|---|
| Unit | `pytest` | Every public function; parametrise with `pytest.mark.parametrize` |
| Property-based | `hypothesis` | Parsers, serialisers, money/date math, invariants |
| Integration | `pytest` + `testcontainers` | Real DB/queue in a container; never mocks for SQL |
| Contract | `schemathesis` / pydantic round-trip | Every external API wrapper |
| Async | `pytest-asyncio` (`asyncio_mode = "auto"`) | Every coroutine has a test |
| Mutation | `mutmut` | Run on core domain packages; kill rate tracked in CI |
| Performance | `pytest-benchmark` | Hot paths listed in `PROJECT.md` |
| Security | `bandit -r src`, `pip-audit` | In `make check` |

- **Mock only at process boundaries** (HTTP, clock, filesystem, randomness) via
  injected Protocols or `pytest-mock`; never patch internal functions.
- **Freeze time and randomness** (`time-machine`, `Random(seed)`) in any test
  touching them.
- **No test touches the network or a real external service**; mark slow
  integration tests and keep unit runs under a minute.

## Security specifics

- **Validate all external input with pydantic** (`extra="forbid"`); never trust
  `request.json` shapes.
- **Secrets from env only** (`pydantic-settings`), never in code or defaults;
  `.env` gitignored, `.env.example` committed.
- **`subprocess.run([...], check=True)`** with argument lists; never `shell=True`
  with interpolated input.
- **`yaml.safe_load`**, `json` over `pickle`, `defusedxml` for XML,
  `secrets` module for tokens (never `random`).
- **SQL through parameters**, never f-strings; ORMs still require review for
  raw fragments.
- `bandit` findings are fixed or suppressed with `# nosec B<code>: reason`.

## Checklist when touching Python code

- [ ] `uv` manages the environment; `uv.lock` updated with any dependency change
- [ ] `ruff format` + `ruff check` clean; no blanket `noqa`
- [ ] Type checker strict passes; no `Any`, no untyped `# type: ignore`
- [ ] Boundaries validated with pydantic; internals use frozen dataclasses
- [ ] No bare `except`; exceptions carry a `code` and chain with `from`
- [ ] `pathlib`, context managers, explicit encodings for all I/O
- [ ] Async code has no blocking calls and uses `TaskGroup` + timeouts
- [ ] File under 300 lines, functions under 50, nesting under 3
- [ ] Unit + property tests added; integration via testcontainers where relevant
- [ ] `bandit` and `pip-audit` clean; secrets come from env
- [ ] No `print`, no commented-out code, TODOs link an issue

---
description: Code standards — size limits, architecture, naming, TypeScript, dead code. Project-agnostic.
---

# Code Standards

These standards apply to every project. Concrete stack facts (framework, file
layout, naming exceptions) live in `PROJECT.md`.

## Size and Complexity Limits

| Scope | Hard Limit | Action |
|---|---|---|
| File | 300 lines | Split before adding code |
| Function / method | 50 lines | Extract smaller functions |
| Component render / view return | 80 lines | Extract sub-components |
| Nesting depth (if/for/try) | 3 levels | Early returns, guard clauses |
| Cyclomatic complexity | 10 per function | Split decision branches |
| Function parameters | 4 params | Use an options/config object |
| Imports per file | 10 modules | File does too much, split it |
| SQL migration | 200 lines | Split into sequential migrations |
| Schema definition (Zod, etc.) | 150 lines | Split by domain |

A 290-line file with a single 250-line function is just as bad as a 500-line file.

**Exemptions** (must be documented in the file header):
- Auto-generated files (DB types, codegen output, vendor exports).
- Generated route trees / manifests.
- Initial schema files until first production deploy, then frozen.
- Locale / i18n files (split by domain once they cross 500 lines).

List project-specific exempt files in `PROJECT.md` if needed.

**Per-language overrides.** A language rule in `languages/` may override a
limit with a documented reason (e.g. Rust modules holding one type's `impl`
blocks). `PROJECT.md` may further override for the project. The override never
exceeds 2x the default; the function limit is never overridden.

## Protocol When Encountering a Large File

When modifying a file over 300 lines (or a function over 50 lines):
1. STOP. Do not add code.
2. Identify distinct responsibilities and extraction candidates.
3. Propose a split plan to the user.
4. Execute after approval. Commit the refactor **separately** from the feature.
5. Implement the feature in the now-smaller file in a separate commit.

When splitting, create a directory named after the file and a single `index`
barrel for the public API. Remove dead code in the process.

## Architecture

- **One unit of responsibility per file.** Extract siblings rather than growing a file.
- **Separate concerns**: UI rendering, data fetching, and business logic live in
  separate files.
- **Early returns over nesting**: replace `if (cond) { ...long block... }` with
  `if (!cond) return;`.
- **No deep prop drilling** (beyond 2 levels): use context, composition, or colocation.
- **Layer the call chain** and never short-circuit it: UI → hooks → business
  logic (`lib/`/`services/`) → data access. UI does not call the database directly.
- **Data access in dedicated files** (e.g. `*.queries.ts` / repository modules),
  never inline in UI or route handlers.
- **Validation schemas centralized** (e.g. `lib/schemas/`), never inline in
  components or handlers.
- **Barrel exports**: external code imports from a module's barrel, not its
  internal files.
- **No data fetching in effects**: use the framework's data layer (server-side
  fetching or a query library), not ad-hoc fetches in lifecycle hooks.

> Framework-specific specializations (e.g. "Server Components by default",
> custom hooks for queries) are valid when the project uses that framework —
> see `PROJECT.md` for the actual stack.

## Configuration

- Read environment variables through a single typed, validated configuration
  boundary per runtime. Application modules receive validated configuration;
  they never read environment variables directly.
- Validate required values, types, ranges, URL schemes, and incompatible options
  before accepting traffic or starting a worker. For serverless/request bindings,
  validate at entry before processing; do not require runtime secrets at build time.
- Missing or invalid required configuration fails explicitly with the variable
  name and expected shape, never its secret value. No silent production defaults.
- Defaults are allowed only for documented optional settings. Parse booleans and
  numbers explicitly; the string "false" must not become a truthy flag.
- Separate public configuration from server secrets with distinct schemas and
  exports. A shared configuration module must not pull secrets into client code.
- Document names, purpose, required environments, and safe example placeholders
  in `.env.example`. Declare the boundary location in `PROJECT.md`.
- Test missing, malformed, out-of-range, conflicting, and valid settings, default
  behavior, and the absence of server secrets from public output.

## Business rules

- Each calculation, eligibility rule, permission decision, and state transition
  has one authoritative implementation owned by a domain module. Declare owners
  and locations alongside the invariants in `PROJECT.md`.
- UI, handlers, scheduled jobs, and integrations invoke that implementation.
  Never duplicate business formulas or status rules in each entry point.
- The server enforces every authoritative decision using trusted identity and
  current data. Client-side previews and disabled controls are usability aids.
- Share safe pure logic when runtimes permit; otherwise expose a server contract
  and verify equivalent projections with common test vectors. Never share secrets
  or server infrastructure merely to reuse a function.
- Represent valid state transitions explicitly; reject invalid transitions and
  verify preconditions atomically with the write when concurrent changes matter.
- Database constraints/RLS remain defense in depth. Where a policy must exist in
  multiple enforcement layers, generate it from one source when possible and
  test agreement; do not remove database protections to avoid duplication.
- Test invariants, rejected transitions, boundary calculations, and all entry
  points that invoke a shared rule. A rule change updates its contract and tests.

## Enforced architecture boundaries

- Record module ownership, public entry points, allowed dependency directions,
  and runtime boundaries in `PROJECT.md` or its linked architecture document.
- Enforce that graph in the check command and CI using import rules, compiler
  module boundaries, or an architecture test appropriate to the language.
- Reject circular dependencies, imports of another module's internals, and
  server-only imports reachable from client code, including transitive imports.
- Domain logic depends on explicit contracts; infrastructure adapters implement
  them. UI and transport handlers do not bypass the domain to perform writes.
- Exceptions identify the exact dependency, reason, owner, and removal condition
  in the architecture document. No blanket directory exclusions.
- Test representative allowed and forbidden imports so configuration changes
  cannot silently disable enforcement. Inspect build output for runtime leaks.

## Naming Conventions

Defaults for JS/TS projects; other languages follow their rule in `languages/`
(which takes precedence for that language).

| Type | Convention | Example |
|---|---|---|
| Component files | PascalCase | `FilterPanel.tsx` |
| Hook files | camelCase with `use` prefix | `useCart.ts` |
| Utility files | kebab-case | `format-price.ts` |
| Type files | `*.types.ts` | `product.types.ts` |
| Constant files | `*.constants.ts` | `cart.constants.ts` |
| Validation files | `*.validation.ts` | `order.validation.ts` |
| Data access files | `*.queries.ts` / `*.repo.ts` | `products.queries.ts` |
| Service files | `*.service.ts` | `orders.service.ts` |
| Test files | `*.test.*` / `*.spec.*` | `format-price.test.ts` |
| Barrel files | `index.*` | `index.ts` |
| Functions / variables | camelCase | `lockProduct`, `cartCount` |
| Types / Interfaces | PascalCase | `Product`, `OrderPickup` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `LOCK_DURATION_MS` |
| DB tables / columns | snake_case | `cart_locks`, `storage_location_id` |

## Import Organization

Order, separated by blank lines:
1. Language/framework imports
2. Third-party libraries
3. Internal shared modules (aliased paths)
4. Local relative imports
5. Type-only imports

## Type Safety (any language)

- **Strictest compiler / type-checker settings on** (`strict: true`, mypy
  strict, `-D warnings`, `-Werror` equivalents). Warnings are errors in CI.
- **No escape hatches** (`any`, `Any`, `interface{}` without constraint,
  `unsafe`, `!!`, force unwrap, `as` casts) except where documented inline with
  the reason, or as the language rule allows.
- **Generated types are generated**: never hand-edit codegen output; derive
  types from it rather than re-declaring them.
- **Validate at every boundary**: all external inputs (API routes, functions,
  forms, jobs, webhooks) are validated with a schema, and types are inferred
  from that schema.
- **Never trust client data**: always re-validate on the server.
- **Make illegal states unrepresentable**: discriminated unions, sealed
  classes, enums with exhaustive matching, newtypes for ids and units.

Language mechanics (TypeScript, Python, Go, Rust, Swift, Kotlin, PHP, Shell,
SQL) live in `languages/`; load the ones `PROJECT.md` activates.

## Dead Code

**Git is the history. The codebase is the present.**

When editing any file:
- Remove all commented-out code without asking.
- Remove unused imports, variables, parameters, and unreachable code.
- Never generate commented-out alternatives (no `// you could also do X`).
- Never leave `// TODO` / `// FIXME` without a linked issue: `// TODO(#142): ...`.
- No debug logging (`console.log`, prints) in committed code — use the project's
  logger / error tracker.
- Flag unused exports and orphan files during refactoring and propose removal.
- `@deprecated` must carry a removal date and a replacement; delete past the date.

### Periodic cleanup
- Find unused dependencies (e.g. `npx depcheck`).
- Find unused locals/params (e.g. `tsc --noUnusedLocals --noUnusedParameters`).
- Resolve or link any `TODO`/`FIXME` lacking an issue.

## Checklist when touching any code
- [ ] File under 300 lines, function under 50, nesting under 3, params under 4 (or documented exemption)
- [ ] One responsibility per file; UI, data fetching, and business logic separated
- [ ] Configuration validated at the runtime boundary; public and secret exports separated
- [ ] Business rules have one owner; server enforcement and invariants tested
- [ ] Architecture dependency checks pass; exceptions narrowly documented
- [ ] Naming follows the table above or the language rule
- [ ] Imports ordered; no barrel bypass; no circular dependency
- [ ] Strictest type settings; no escape hatch without an inline reason
- [ ] External input validated with a schema at the boundary
- [ ] No commented-out code, unused symbols, debug logging, unlinked TODO
- [ ] Generated files untouched; types derived from them

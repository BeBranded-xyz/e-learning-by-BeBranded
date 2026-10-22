---
description: TypeScript language rules — tsconfig strictness, type modelling, error returns, async, ESM, testing stack. Apply to every TypeScript file and tsconfig.
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "tsconfig*.json"
---

# TypeScript

## When this applies

Apply to every file matching the globs. Generic rules (size limits, naming
table, import order, dead code, "no `any`", "validate at boundaries") live in
`core/code-standards.mdc` and are not repeated here; this file adds what is
specific to TypeScript. Framework and runtime facts (Next.js, Node version,
edge targets) live in `PROJECT.md`.

## Toolchain

| Concern | Tool | Rule |
|---|---|---|
| Node version | `.nvmrc` / `.node-version` (fnm, volta, mise) | Committed; CI reads it |
| Package manager | **pnpm** | `packageManager` field in `package.json`; `corepack enable` |
| Formatter + linter | **Biome** (default) or ESLint + Prettier | Never both stacks in one repo |
| Type checker | `tsc --noEmit` | Runs in CI on every push |
| Test runner | **Vitest** | Coverage via `@vitest/coverage-v8` |
| Check command | **`pnpm check`** | `pnpm typecheck && pnpm lint && pnpm test` |

`pnpm check` is the single gate; it must pass locally before any commit and in CI
before merge. Required `tsconfig.json` compiler options (never relax them):

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "isolatedModules": true
  }
}
```

Use `tsconfig.base.json` in monorepos and `extends` per package. Never add
`// @ts-ignore`; `// @ts-expect-error` is allowed with a reason on the same line.

## Project layout

```
src/
  app/ | routes/     framework entry points (thin)
  components/        UI only
  hooks/             React hooks (use*.ts)
  lib/
    schemas/         zod/valibot schemas, one file per domain
    services/        business logic (*.service.ts)
    queries/         data access (*.queries.ts)
    errors.ts        AppError + reason codes
    result.ts        Result type helpers
    env.ts           validated environment
  types/             shared *.types.ts (no runtime code)
tests/               integration/E2E; unit tests sit next to source
```

**Path aliases**: one alias `@/` -> `src/` declared in `tsconfig.json` `paths`
and mirrored in the bundler config. No other aliases.

**Barrel policy**: one `index.ts` per feature module exporting the public API
only. No barrel at `src/` root, no `export * from`, no barrel that pulls heavy
runtime code you do not need (they defeat tree-shaking and create cycles).

## Naming conventions

File and identifier naming follows the table in `core/code-standards.mdc`.
TypeScript additions:

| Thing | Convention | Example |
|---|---|---|
| Type-only file | `*.types.ts`, no runtime exports | `order.types.ts` |
| Schema | `xSchema` camelCase, inferred type with same base name | `orderSchema`, `Order` |
| Branded id type | `<Entity>Id` | `UserId` |
| Discriminant key | `kind` (domain unions) / `type` (events) | `{ kind: "paid" }` |
| Result helpers | `ok()`, `err()`, `Result<T, E>` | `return err({ code: "not_found" })` |

## Language idioms and rules

### Types
- **`type` by default; `interface` only for object shapes meant to be extended or
  implemented** (public class contracts, declaration merging). Never mix both for
  the same concept.
- **Discriminated unions for state and variants**; exhaustive `switch` with a
  `never` check in `default`. Never model state with boolean flag combinations.
- **No `enum`.** Use `as const` objects and derive the union:
  `const Status = { active: "active", paused: "paused" } as const;`
  `type Status = (typeof Status)[keyof typeof Status];`
- **`satisfies` for config objects and lookups** to keep literal types while
  checking shape; never annotate with a wide type and lose literals.
- **Branded types for every id** (`type UserId = string & { readonly __brand: "UserId" }`)
  created only through a validated constructor or schema `.brand<"UserId">()`.
  Never pass raw `string` ids between layers.
- **`unknown`, never `any`**; narrow with type guards, `in`, `instanceof`, or a
  schema `parse`. No non-null assertion (`!`): use a guard, `??`, or an explicit
  `assertDefined(value, "reason")` helper.
- **Derive, do not duplicate**: `z.infer`, `ReturnType`, `Parameters`, `Pick`,
  `keyof typeof`. A type that mirrors a schema or a constant by hand is a bug.

### Errors
- **Expected outcomes return a `Result`; unexpected failures throw.** If a caller
  has a sensible branch (not found, validation, conflict, rate limit), return
  `err({ code, message })`; if it means a bug or an outage (DB down, invariant
  broken), throw an `AppError` with a `code`.
- **One `AppError` class** with a machine-readable snake_case `code`, an optional
  `cause`, and no PII in `message`. Reason codes live in `lib/errors.ts`.
- **Never `catch (e) {}`**; handle, wrap with `cause`, or rethrow. Never log and
  rethrow. The caught value is `unknown` and must be narrowed.

### Boundaries and validation
- **Validate at every boundary with zod or valibot** (see `PROJECT.md` for which):
  request bodies, query params, env vars, webhook payloads, `JSON.parse` output,
  storage reads. Parse once at the edge, pass typed values inward.
- **Env vars go through one validated `env.ts`** (`z.object({...}).parse(process.env)`)
  imported everywhere else; never read `process.env` directly.
- **Schemas live in `lib/schemas/`**; infer types from them, never re-declare.

### Modules
- **ESM only**: `"type": "module"`, `import`/`export`, `import type` for types
  (enforced by `verbatimModuleSyntax`). No `require`, no `__dirname` (use
  `import.meta.url`). No default exports except where a framework requires them.

### Async and concurrency
- **No floating promises**: every promise is `await`ed, returned, or passed to
  `void` with a comment on why fire-and-forget is safe. Enable the
  `noFloatingPromises` lint rule.
- **Every outbound call accepts an `AbortSignal`** and forwards it to `fetch`,
  timers, and SDKs; use `AbortSignal.timeout(ms)` for deadlines.
- **`Promise.all` for independent work; `Promise.allSettled` when partial failure
  is acceptable**; bound concurrency (`p-limit`) for loops over many items.
  Never `await` inside `forEach`; no `setTimeout` without cleanup in components.

### Runtime differences
- **Declare the target runtime per entry point** (Node, edge/Workers, browser)
  and respect it: edge has no `fs`, no `net`, no Node built-ins unless polyfilled,
  limited CPU time, and Web-standard `Request`/`Response`. Node code uses the
  `node:` prefix on built-ins.
- **Shared code must be runtime-neutral** (Web APIs only); Node-only helpers live
  in clearly named files never imported from edge or browser bundles.

### Forbidden
`any`, `enum`, non-null `!`, `@ts-ignore`, `as unknown as X`, `require`,
`export *`, `Function` and `{}` types, `Number` for money (use integer minor
units or a decimal library), `Date` math without a library or explicit UTC.

## Size limit overrides

None. Core limits apply. Generated files (`*.gen.ts`, DB types, route trees)
are exempt and must say so in a header comment.

## Dependencies

- **Add with `pnpm add` (`-D` for tooling)**; commit `pnpm-lock.yaml`; CI uses
  `pnpm install --frozen-lockfile`; `save-exact` in `.npmrc` for tooling.
- **Prefer the platform** (`fetch`, `URL`, `crypto.randomUUID`, `structuredClone`)
  before adding a dependency. Justify every new runtime dependency in the PR
  (size, maintenance, alternatives).
- **Audit**: `pnpm audit --prod` in CI (fail on high/critical), `knip` for unused
  exports, files and dependencies, `depcheck` as a second opinion.

## Testing

Tests are mandatory. Unit tests live next to the source (`x.test.ts`);
integration and E2E in `tests/`. Mock at boundaries only (HTTP, DB, clock,
randomness); never mock your own modules to make a test pass.

| Category | Tool | What it covers |
|---|---|---|
| Unit | Vitest | Pure functions, services, reducers, schemas |
| Property-based | fast-check | Parsers, serializers, money/date math, invariants |
| Component | Testing Library (`@testing-library/react`, `user-event`) | Behaviour via roles/labels, never implementation |
| HTTP mocking | msw | Every third-party call in unit and component tests |
| Integration | Vitest + real DB (container or local) | Queries, migrations, service to data layer |
| Contract | Schema tests against recorded fixtures | Webhook and API payload shapes |
| E2E | Playwright | Critical user journeys, desktop and mobile viewports |
| Mutation | Stryker | Quarterly, or on `lib/` critical modules in CI |
| Security | `pnpm audit`, semgrep (optional) | Dependencies, injection patterns |

Rules:
- **Every `Result` error branch and every `switch` arm has a test.**
- **Coverage threshold** set in `vitest.config.ts` (number in `PROJECT.md`); it
  never goes down in a PR. `pnpm test:e2e` runs on main and release PRs.

## Security specifics

- **Secrets only via validated `env.ts`**; `NEXT_PUBLIC_`/`VITE_` prefixed vars
  are public by definition, never put secrets there.
- **No `eval`, `new Function`, `dangerouslySetInnerHTML` with unsanitised input**;
  sanitise with DOMPurify when HTML is unavoidable.
- **Regex from input is forbidden**; check hand-written patterns for ReDoS.
- **`JSON.parse` output is `unknown`** and goes through a schema.
- **Postinstall scripts blocked** (`pnpm` default); review `pnpm approve-builds`
  additions and lockfile diffs in dependency PRs.

## Checklist when touching TypeScript code

- [ ] `tsconfig` strict flags intact; no `@ts-ignore`, no `any`, no `!`
- [ ] Types derived from schemas or constants, not re-declared by hand
- [ ] Ids are branded; unions are discriminated and exhaustively switched
- [ ] External input parsed with a schema at the boundary
- [ ] Expected failures return `Result`; unexpected ones throw `AppError` with a code
- [ ] No floating promises; outbound calls take an `AbortSignal`
- [ ] Runtime-neutral shared code; `node:` imports only in Node entry points
- [ ] ESM, `import type`, no `export *`, one `@/` alias
- [ ] New dependency justified; lockfile updated; `knip` and `pnpm audit` clean
- [ ] Unit, property, and boundary tests added; msw for HTTP; E2E if a journey changed
- [ ] `pnpm check` passes locally

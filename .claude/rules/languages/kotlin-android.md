---
description: Kotlin rules for native Android — Gradle KTS with version catalog, modularization, Jetpack Compose, Hilt, coroutines and Flow, Room, security config, testing stack. Apply to every Kotlin file, Gradle script and manifest.
paths:
  - "**/*.kt"
  - "**/*.kts"
  - "**/AndroidManifest.xml"
---

# Kotlin (Android)

## When this applies

Apply to every file matching the globs in a native Android project. Generic
rules (size limits, dead code, secrets, structured errors) live in
`core/code-standards.mdc`. `minSdk`, `targetSdk`, application id, signing and
Play track names live in `PROJECT.md`.

## Toolchain

| Concern | Tool | Rule |
|---|---|---|
| JDK | Toolchain declared in Gradle (`jvmToolchain`) | CI and local use the same major |
| Kotlin, AGP, libraries | **Gradle version catalog** (`gradle/libs.versions.toml`) | No version literal in any build script |
| Build scripts | **Gradle Kotlin DSL** (`*.kts`) with convention plugins in `build-logic/` | No Groovy, no copy-pasted `android {}` blocks |
| Formatter | **ktfmt** (Kotlin style) or **ktlint** (one per project) | Runs on save and in CI |
| Linter | **detekt** with a committed `detekt.yml`; **Android Lint** (`./gradlew lint`) | Both fail the build on new issues |
| Type checker | The Kotlin compiler with `allWarningsAsErrors = true`; explicit API mode in library modules | No `@Suppress` without an issue link |
| Test runner | JUnit 5 (unit), AndroidJUnitRunner (instrumented) | See Testing |
| Check command | **`./gradlew check`** | Format check, detekt, lint, unit and screenshot tests |

`./gradlew check` is the single gate, configured once in the convention plugin so
every module inherits it. Use the Gradle wrapper only.

## Project layout

```
app/                      thin: Application, MainActivity, navigation host, DI graph
build-logic/              convention plugins (android-library, compose, hilt, test)
core/
  common/                 Result, dispatchers, coroutine helpers
  designsystem/           theme, tokens, reusable composables
  network/                Retrofit/Ktor client, interceptors, DTOs
  database/               Room database, DAOs, migrations
  model/                  domain models (pure Kotlin, no Android imports)
  testing/                fakes, test rules, fixtures
feature/
  <name>/                 one module per feature: ui/, viewmodel/, usecase/, di/
data/
  <name>/                 repositories + data sources per domain
gradle/libs.versions.toml
```

Dependency direction: `app -> feature -> data -> core`. `core/model` is pure
Kotlin (JVM library). A feature never depends on another feature; shared
contracts go into `core`.

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Packages | lowercase, reverse domain from `PROJECT.md` | `com.example.feature.checkout` |
| Classes, interfaces | UpperCamelCase; no `I` prefix | `OrderRepository`, `DefaultOrderRepository` |
| Functions, properties | lowerCamelCase | `loadOrders()` |
| Composables | UpperCamelCase noun, `Modifier` first optional param | `OrderList(orders, modifier = Modifier)` |
| ViewModel | `<Screen>ViewModel` | `CheckoutViewModel` |
| Use case | `<Verb><Noun>UseCase` with `operator fun invoke` | `PlaceOrderUseCase` |
| UI state | `<Screen>UiState` sealed interface | `CheckoutUiState` |
| Constants | `const val` UPPER_SNAKE_CASE in an `object` | `Limits.MAX_RETRIES` |
| Resources | snake_case with type prefix | `ic_cart`, `btn_pay` |
| Test classes | `<Class>Test`, functions with backticks | `` fun `emits error when network fails` `` |
| Modules | `:feature:checkout`, `:core:network` | Gradle paths mirror folders |

## Language idioms and rules

### Types and immutability
- **`val` by default; `var` only for local loop state**. Public mutable
  properties are forbidden; expose `StateFlow`, not `MutableStateFlow`.
- **`data class` for models**, all properties `val`; copy with `copy()`.
- **Immutable collections in public APIs**: read-only `List`, `Map`, `Set`, or
  `kotlinx.collections.immutable` for Compose state to keep composables skippable.
- **Sealed interfaces for state and errors**: `sealed interface UiState { data
  object Loading; data class Ready(...); data class Failed(val error: AppError) }`
  with exhaustive `when` (no `else` branch on sealed types).

### Null safety
- **No `!!`.** Use `?.`, `?:`, `requireNotNull(x) { "reason" }`, or restructure.
- **Nullable only when absence is meaningful**; otherwise use a sealed state.
  `lateinit` only for framework-injected fields in Android components.

### Errors
- **One `AppError` sealed hierarchy** in `core/model` with a machine-readable
  `code` and no PII in messages; network and database exceptions are mapped to
  it at the data layer.
- **Return the project `Result<T>` from repositories and use cases**; throw only
  for programmer errors.
- **Never catch `Throwable` or `Exception` broadly** in coroutines; it swallows
  `CancellationException`. Catch specific types or rethrow cancellation; the
  same applies to `runCatching`.

### Coroutines and Flow
- **Structured concurrency**: every coroutine runs in `viewModelScope`,
  `lifecycleScope`, or an injected `CoroutineScope`. **`GlobalScope` is forbidden.**
- **Dispatchers are injected** (`@IoDispatcher`, `@DefaultDispatcher` qualifiers),
  never referenced as `Dispatchers.IO` inside business code, so tests can swap
  them. `suspend` functions are main-safe by contract (`withContext` at the
  data layer only).
- **Repositories expose cold `Flow`; view models expose `StateFlow` via
  `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initial)`**.
- **Collect in UI with `collectAsStateWithLifecycle()`**; never `collect` inside a
  composable body or in `onCreate`.

### Architecture
- **UI -> ViewModel -> UseCase -> Repository -> DataSource**, no layer skipped.
  Composables never see a repository; view models never see Retrofit or Room.
- **Hilt for DI**: `@HiltViewModel`, `@Module @InstallIn` per layer, constructor
  injection everywhere. No service locators, no `object` singletons holding
  state, no static context.

### Jetpack Compose
- **Stateless composables**: state and callbacks come in as parameters
  (`state: UiState, onPay: () -> Unit`); hoist state to the screen level.
- **Route + content split**: `CheckoutRoute` collects the view model,
  `CheckoutScreen(state, actions)` is pure and previewable.
- **`@Preview` for every content composable** covering light/dark and a loading
  and error state; use `@PreviewParameter` providers.
- **Stable parameters**: immutable collections, `@Immutable`/`@Stable` on
  classes the compiler cannot infer; check the Compose compiler metrics report.

### Persistence
- **Room with `exportSchema = true`**, schemas committed under `schemas/`, and
  **every migration has a test** with `MigrationTestHelper`. Never
  `fallbackToDestructiveMigration` in release builds.
- **DataStore (Proto preferred) over `SharedPreferences`** for settings.
- **Secrets and tokens in Android Keystore-backed storage** (Jetpack Security
  `EncryptedSharedPreferences`/`EncryptedFile` or Tink); never in DataStore or
  plain files.

### Forbidden
`!!`, `GlobalScope`, hardcoded `Dispatchers.*` outside DI, `runBlocking` outside
tests, `AsyncTask`, `LiveData` in new code, `object` service singletons, `Log.d`
in committed code (use the injected logger), XML layouts in new screens,
reflection-based JSON, `System.currentTimeMillis()` outside an injected `Clock`.

## Size limit overrides for Kotlin (Android)

| Scope | Limit | Reason |
|---|---|---|
| Composable function | 80 lines | Matches core component limit; extract sub-composables |
| `libs.versions.toml`, convention plugins, `@Database` classes | Exempt from line and import limits | Declarative config |

## Dependencies

- **Every dependency and plugin is declared in `libs.versions.toml`** and
  referenced as `libs.x.y`; bundles for groups (e.g. `libs.bundles.compose`).
- **Prefer AndroidX and Kotlin first-party libraries**; justify every third-party
  dependency in the PR (size, maintenance, license, SDK privacy).
- **Dependency analysis**: `com.autonomousapps.dependency-analysis` plugin in CI
  (`./gradlew buildHealth`) fails on unused or misdeclared (`api` vs
  `implementation`) dependencies.
- **Security audit**: OWASP `dependency-check` Gradle plugin in CI, failing on
  high/critical CVEs; Renovate or Dependabot on the version catalog, AGP and
  Kotlin majors updated by hand with the migration guide linked.

## Testing

Unit tests live in `src/test`, instrumented in `src/androidTest`, screenshot
tests in the module's `src/test`. Fakes live in `core/testing`; mock only
external boundaries (network, system services, clock).

| Category | Tool | What it covers |
|---|---|---|
| Unit | JUnit 5 + **MockK** + **Turbine** + `kotlinx-coroutines-test` (`runTest`, `StandardTestDispatcher`) | View models, use cases, repositories, mappers |
| Property-based | **kotest** property testing (`checkAll`, `Arb`) | Parsers, money and date maths, serialization round-trips |
| Robolectric | Robolectric for framework-dependent unit tests | Resources, `Context`, DataStore, Room in memory |
| Compose UI | `createComposeRule` + semantics matchers | Every screen: states, actions, accessibility labels |
| Screenshot | **Paparazzi** or **Roborazzi** (JVM, no emulator) | Every content composable in light/dark, font scale 1.0 and 1.5, phone and tablet |
| Integration | Room in-memory + `MigrationTestHelper`; MockWebServer for network | DAOs, migrations, API client and interceptors |
| E2E (instrumented) | Espresso / Compose UI test on device | Critical journeys on **Firebase Test Lab** or a Gradle Managed Devices matrix (min and target API, phone + tablet) |
| Performance | **Macrobenchmark** (startup, scroll jank) with committed baselines; **Baseline Profiles** generated and shipped | Startup and key screens |
| Concurrency | `advanceUntilIdle`, Turbine `expectNoEvents`; **StrictMode** enabled in debug builds | Dispatcher misuse, main-thread I/O |
| Security | OWASP dependency-check, `./gradlew lint` security checks, manifest review | Every release |

Rules:
- **Every sealed state branch and every `AppError` type has a test.**
- **Inject `Clock` and dispatchers**; no `Thread.sleep` or real-time `delay`.
- **Instrumented suites run on the main branch and release PRs**; everything
  else runs in `./gradlew check` on every push.

## Security specifics

- **Secrets never in source, `BuildConfig`, or a committed `local.properties`**;
  inject via CI secrets at build time. API keys that must ship are restricted
  per package + SHA-256 on the provider side.
- **Network security config** (`res/xml/network_security_config.xml`) with
  cleartext disabled; certificate pinning with backup pins for high-value APIs;
  user CA store not trusted in release.
- **R8 enabled in release** (`isMinifyEnabled`, `isShrinkResources`); keep rules
  minimal and documented; mapping files uploaded to the crash reporter.
- **Permissions minimal**, requested at point of use, with a rationale; no
  `QUERY_ALL_PACKAGES`, no legacy storage. Review the merged manifest in CI.
- **Exported components** explicit (`android:exported`) and protected by a
  permission or signature check; deep-link inputs validated.
- **No sensitive data in logs**; release builds strip `Log` via R8 rules.

## Checklist when touching Kotlin (Android) code

- [ ] Versions only in `libs.versions.toml`; convention plugins, no inline config
- [ ] Layering respected (UI -> ViewModel -> UseCase -> Repository -> DataSource)
- [ ] `val`, data classes, immutable collections, sealed state and errors
- [ ] No `!!`, no `GlobalScope`, dispatchers injected, cancellation not swallowed
- [ ] Composables stateless and hoisted; previews for each state
- [ ] Room migration added and tested; DataStore for prefs; Keystore for secrets
- [ ] Manifest: permissions minimal, `exported` explicit, network config intact
- [ ] Unit + Turbine + screenshot tests added; Compose UI test if a screen changed
- [ ] Macrobenchmark and baseline profile updated when a hot path changed
- [ ] `buildHealth` and OWASP dependency-check clean; new dependency justified
- [ ] `./gradlew check` passes

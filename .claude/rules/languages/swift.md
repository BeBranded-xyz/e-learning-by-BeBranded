---
description: Swift language rules for Apple platforms — Swift 6 strict concurrency, SwiftUI architecture, value types, typed errors, SPM, testing and release flow. Apply to every Swift file and package manifest.
paths:
  - "**/*.swift"
  - "Package.swift"
  - "*.xcodeproj/**"
---

# Swift

## When this applies

Apply to every file matching the globs. Generic rules (size limits, dead code,
secrets, structured errors) live in `core/code-standards.mdc`. Deployment
targets, bundle identifiers, signing team and the list of supported platforms
live in `PROJECT.md`.

## Toolchain

| Concern | Tool | Rule |
|---|---|---|
| Swift / Xcode version | `.swift-version` + `.xcode-version` (xcodes, mise) | Committed; CI reads it |
| Package manager | **Swift Package Manager** | No CocoaPods, no Carthage; migrate legacy pods |
| Formatter | **SwiftFormat** (`.swiftformat` at repo root) | Runs on save and in CI |
| Linter | **SwiftLint** (`.swiftlint.yml`, strict mode) | Warnings fail CI |
| Type checker | The compiler in Swift 6 language mode, `-strict-concurrency=complete` | No `@preconcurrency` silencing without an issue link |
| Test runner | **Swift Testing** for new tests, XCTest where a runner requires it | `xcodebuild test` |
| Check command | **`make check`** | `swiftformat --lint . && swiftlint --strict && xcodebuild test` |

Enable in every target: Swift 6 language mode, `SWIFT_STRICT_CONCURRENCY = complete`,
`SWIFT_TREAT_WARNINGS_AS_ERRORS = YES`. Build settings live in `xcconfig`
files, never edited by hand in the project file; prefer a generated project
(Tuist or XcodeGen) when more than a few people touch it.

## Project layout

```
App/                 app target: entry point, App struct, DI wiring only
Features/            one SPM package or folder per feature
  Checkout/
    Sources/         Views/, ViewModels/, Models/
    Tests/
Core/                shared packages: Networking, Persistence, Design, Analytics
Resources/           Assets.xcassets, Localizable.xcstrings, fonts
Config/              *.xcconfig per environment, entitlements
Tests/               UI tests, snapshot tests, performance tests
```

Features depend on `Core`; `Core` never imports a feature. Cross-feature calls
go through a protocol declared in `Core`.

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Types, protocols | UpperCamelCase; protocols describe a capability | `OrderRepository`, `Cacheable` |
| Functions, vars, cases | lowerCamelCase | `fetchOrders()`, `.paymentFailed` |
| Files | One primary type per file, same name | `OrderListView.swift` |
| View | `<Name>View` | `CheckoutView` |
| View model | `<Name>Model` or `<Name>ViewModel` (one per project) | `CheckoutModel` |
| Protocol implementation | `Live` / `Mock` prefix | `LiveOrderRepository` |
| Errors | `<Domain>Error` enum | `PaymentError` |
| Tests | `<Type>Tests` file, `@Test("behaviour")` names | `CheckoutModelTests.swift` |
| Constants | `static let` in a caseless enum namespace | `enum Layout { static let gutter: CGFloat = 16 }` |

## Language idioms and rules

### Types
- **Value types by default**: `struct` and `enum`. `class` only for identity,
  reference-shared state, or framework requirements; mark it `final`.
- **Protocol-oriented**: depend on small protocols (`OrderRepository`), inject
  the implementation. A protocol with one implementation and no test double is
  a smell; remove it.
- **Model state as enums with associated values** (`enum LoadState { case idle,
  loading, loaded([Item]), failed(AppError) }`); never combine optionals and
  booleans to express one state.
- **`let` over `var`**; immutable models; `mutating` methods return new values
  where practical.
- **No stringly-typed APIs**: identifiers wrapped in `struct UserID: Hashable,
  Codable, Sendable { let rawValue: String }`, keys as enums, resources via
  generated symbols.

### Optionals
- **No force unwrap (`!`), no `try!`, no `as!` outside test targets.** Use
  `guard let`, `if let`, `??`, or a thrown error. Implicitly unwrapped optionals
  are forbidden.
- **`guard` early exits at the top of a function**; at most 3 nesting levels.

### Errors
- **Typed throws** (`func load() throws(NetworkError)`) for domain APIs; `any
  Error` only at framework boundaries.
- **One error enum per domain** conforming to `Error`, `Sendable`, and carrying a
  machine-readable `code: String` plus a localised `userMessage`. Wrap
  underlying errors as an associated value; never lose the cause.
- **Never `try?` to swallow an error** unless the failure is documented as
  ignorable in a comment on that line.

### Concurrency (Swift 6)
- **Structured concurrency only**: `async let`, `TaskGroup`, `Task { }` bound to
  a view or object lifetime. No detached tasks except documented startup work;
  cancel tasks in `deinit` or via the `.task` modifier.
- **Everything crossing an isolation boundary is `Sendable`**; models are
  `struct: Sendable`. Never use `@unchecked Sendable` without a lock and a
  comment explaining the invariant.
- **Actors for mutable shared state** (caches, connections, stores).
  **`@MainActor` for anything touching UI**: views, view models, navigation.
  Never hop with `DispatchQueue.main.async`.
- **No `Task.sleep` for synchronisation**; no semaphores; no locks in async code
  (use an actor). Check `Task.isCancelled` in loops.

### SwiftUI architecture
- **Views are thin**: layout and binding only, body under 80 lines, no business
  logic, no networking, no formatting code (use `FormatStyle`).
- **`@Observable` view models**, `@MainActor`, one per screen, owning state and
  actions; they call use cases or repositories, never SDKs directly.
- **Dependencies via `Environment`**: declare an `EnvironmentKey` per service
  protocol (or a small container), inject `Live*` in `App` and `Mock*` in
  previews and tests. No singletons (`.shared`) for services; `static let
  shared` is only acceptable for stateless formatters.
- **Navigation state is data** (`NavigationPath` or an enum stack) owned by a
  coordinator or the screen model, not spread across views.
- **Every view has a `#Preview`** with mock dependencies covering at least the
  loaded and error states.

### Resources
- **Localise every user-facing string** in `Localizable.xcstrings`; no literal
  strings in views. Use `String(localized:)` with a comment for translators.
- **Assets referenced by generated symbols** (`.primaryColor`, `Image(.logo)`).
- **Deterministic cleanup**: `defer` for handles and observers;
  `withCheckedContinuation` resumes exactly once.

### Forbidden
`!` unwrap, `try!`, `as!`, `@unchecked Sendable` without justification,
`DispatchQueue` in new code, `NotificationCenter` for app state, `UserDefaults`
for secrets, `print()`, `Any`/`AnyObject` in public signatures, `ObservableObject`
in new code (use `@Observable`), storyboards and XIBs.

## Size limit overrides for Swift

| Scope | Limit | Reason |
|---|---|---|
| SwiftUI `body` | 80 lines | Same as core component limit; extract subviews |
| View file with previews | 350 lines | `#Preview` blocks count but should not force a split |
| `Package.swift` | Exempt | Declarative manifest |

## Dependencies

- **SPM only**: add in `Package.swift` or the Xcode package list, commit
  `Package.resolved`, pin with `from:` and review majors by hand.
- **Prefer Apple frameworks** (Foundation `URLSession`, `SwiftData`/Core Data,
  `OSLog`, `CryptoKit`) before third-party code. Every new dependency needs a
  justification in the PR: binary size, maintenance, license, privacy manifest.
- **Third-party SDKs must ship a `PrivacyInfo.xcprivacy`**; no SDK that needs
  tracking permission without product approval (see `PROJECT.md`).
- **Audit**: `swift package show-dependencies` reviewed on each update; an OSV
  scan of `Package.resolved` in CI; Renovate or Dependabot for SPM enabled.

## Testing

Unit tests live in each package's `Tests/` target; UI, snapshot and performance
tests in the top-level `Tests/`. Mock only at protocol boundaries (network,
persistence, clock, keychain); never mock a view model to test a view.

| Category | Tool | What it covers |
|---|---|---|
| Unit | **Swift Testing** (`@Test`, `#expect`, parameterised tests) | Models, view models, use cases, formatters |
| Property-based | SwiftCheck or generators with parameterised `@Test` | Parsers, money and date maths, Codable round-trips |
| Snapshot | swift-snapshot-testing | Every view in light/dark, Dynamic Type XL, RTL; recorded on the CI simulator |
| Integration | Swift Testing + in-memory store or local server | Repositories, persistence migrations, networking wrappers |
| Contract | Decoding fixtures recorded from the real API | Every API response type |
| UI / E2E | XCUITest | Critical journeys; accessibility identifiers on every interactive element |
| Concurrency | Thread Sanitizer runs with `-strict-concurrency=complete` | Actors, cancellation, ordering |
| Performance | XCTest `measure` with `XCTClockMetric`, `XCTMemoryMetric`, `XCTCPUMetric` | Launch, first render, heavy lists; baselines committed |
| Fuzz | libFuzzer (`-sanitize=fuzzer`) or corpus-driven tests on parsers | Any hand-written parser or decoder |
| Profiling | Instruments (Time Profiler, Allocations, Hangs) before release | Part of the release checklist |
| Security | Static scan of entitlements, ATS exceptions, SDK privacy manifests | Every release |

Rules:
- **Every enum case of a state and every error case has a test.**
- **Inject a `Clock` and a random source**; no `sleep` in tests, use
  `confirmation` or task-group timeouts.
- **Snapshot diffs are reviewed in the PR** and re-recorded only with a reason.
- **CI matrix**: minimum and latest supported OS on iPhone and iPad (and Mac if
  targeted, see `PROJECT.md`).
- **TestFlight flow**: every internal build is tagged, has release notes, and
  passes `make check`; external TestFlight only from the release branch after
  snapshot and UI suites pass.

## Security specifics

- **Secrets in Keychain only** (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly` by
  default); never `UserDefaults`, plist, or source. Build-time keys come from
  git-ignored `xcconfig` files generated by CI.
- **App Transport Security stays on**; no `NSAllowsArbitraryLoads`. Any exception
  is per-domain, documented, and tracked with a removal issue.
- **Certificate pinning** for high-value APIs via `URLSessionDelegate`; rotate
  with backup pins.
- **Minimal entitlements and permissions**; every usage-description string
  explains the real purpose; request at the moment of use.
- **Privacy manifest** (`PrivacyInfo.xcprivacy`) declares required-reason APIs
  and tracking domains; CI fails if a used API is undeclared.
- **No sensitive data in logs**: `OSLog` with `privacy: .private` for user
  values; no `print`. Hide sensitive screens when `scenePhase != .active`.

## Checklist when touching Swift code

- [ ] Value types, `final` classes, protocols for dependencies
- [ ] No `!`, `try!`, `as!`, `@unchecked Sendable` without justification
- [ ] Typed throws with a domain error enum; no swallowed `try?`
- [ ] Sendable across isolation; actors for shared state; `@MainActor` for UI
- [ ] Views thin, `@Observable` model, dependencies via `Environment`, no singletons
- [ ] Strings localised, assets via generated symbols, `#Preview` present
- [ ] Secrets in Keychain, ATS intact, permissions minimal and justified
- [ ] Unit + snapshot tests added; UI test if a journey changed
- [ ] Performance baseline unchanged or updated with a reason
- [ ] `Package.resolved` committed; new dependency justified with privacy manifest
- [ ] `make check` passes with strict concurrency and warnings as errors

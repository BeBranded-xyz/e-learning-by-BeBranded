---
description: React Native rules with Expo as the default — managed workflow, expo-router, EAS Build and Update, state, styling, lists, performance, native modules, secure storage, testing on both platforms. Apply to Expo and RN config files and the app code they govern.
paths:
  - "**/app.json"
  - "**/app.config.*"
  - "**/metro.config.*"
  - "**/eas.json"
---

# React Native (Expo)

## When this applies

Apply when `PROJECT.md` declares a React Native app, and to every file matching
the globs. All TypeScript rules (strict flags, `Result` errors, schemas at
boundaries, async rules, dependency policy) come from `languages/typescript.mdc`
and are not repeated here. Bundle identifiers, store accounts, EAS project id,
and supported OS versions live in `PROJECT.md`.

## Toolchain

| Concern | Tool | Rule |
|---|---|---|
| Framework | **Expo SDK, managed workflow** | Bare workflow only with a written reason in `PROJECT.md` |
| Package manager | pnpm (see `typescript.mdc`) | `node-linker=hoisted` in `.npmrc` for Metro |
| Router | **expo-router** (file-based, typed routes on) | No hand-rolled navigation container |
| Formatter + linter | Biome or ESLint (`eslint-config-expo`) + Prettier | One stack per repo |
| Type checker | `tsc --noEmit` extending `expo/tsconfig.base` | Strict flags from `typescript.mdc` |
| Test runner | Jest with `jest-expo` preset | E2E via Maestro or Detox |
| Build and release | **EAS Build**, **EAS Submit**, **EAS Update** | `eas.json` profiles: `development`, `preview`, `production` |
| Check command | **`pnpm check`** | typecheck + lint + `expo-doctor` + unit tests |

## Project layout

```
app/                    expo-router routes only (thin wrappers around screens)
  (tabs)/  (auth)/      route groups
  _layout.tsx           root providers: query client, theme, auth gate
src/
  features/<name>/      screen components, hooks, feature state
  components/           shared UI (design system)
  lib/
    api/                fetchers + TanStack Query hooks
    schemas/            zod schemas for API and storage
    storage/            secure-store and async-storage wrappers
    env.ts              validated public config
  stores/               zustand stores (client state only)
  theme/                tokens, nativewind config
modules/                local Expo Modules (native code) when unavoidable
app.config.ts           dynamic config (reads env, per-profile ids)
eas.json                build/update profiles
```

Route files under `app/` import a feature screen and export it, nothing else.
Platform-specific code lives in `.ios.tsx` / `.android.tsx` / `.web.tsx` files
next to the shared one; never `Platform.OS` ladders inside render code.

## Naming conventions

Follow `core/code-standards.mdc` and `languages/typescript.mdc`. Additions:

| Thing | Convention | Example |
|---|---|---|
| Route file | kebab-case, dynamic segments in brackets | `app/orders/[id].tsx` |
| Screen component | `<Name>Screen` in `src/features` | `OrderDetailScreen` |
| Query hook | `use<Entity>Query` / `use<Action>Mutation` | `useOrderQuery`, `usePlaceOrderMutation` |
| Zustand store | `use<Name>Store` | `useCartStore` |
| Platform file | `Name.ios.tsx` / `Name.android.tsx` | `DatePicker.ios.tsx` |
| EAS profile and update channel | Same name: `development`, `preview`, `production` | `eas update --channel production` |

## Language idioms and rules

### Navigation
- **expo-router with typed routes** (`experiments.typedRoutes`); navigate with
  `router.push({ pathname, params })`, never string concatenation.
- **Route params are validated with a schema** in the screen before use; they are
  external input. Auth gating happens by redirect in `_layout.tsx`, not per screen.
- **Deep links and universal links** declared in `app.config.ts` (`scheme`,
  `associatedDomains`, `intentFilters`); every link route is tested, logged out too.

### State
- **Server state in TanStack Query**: one hook per endpoint in `lib/api`, keys
  from a `queryKeys` factory, `staleTime` set explicitly, persisted cache via
  the async-storage persister for offline reads.
- **Client state in zustand (or context for small scopes)**: UI flags, drafts,
  session. Never store server data in zustand; never store secrets in any
  persisted store. Stores expose a `reset()` for tests.
- **Offline handling**: `onlineManager` wired to `@react-native-community/netinfo`;
  mutations use `networkMode: "offlineFirst"` with retry, the UI shows a visible
  offline state, and writes are queued, not dropped.

### Styling
- **One styling approach per project** (see `PROJECT.md`): **NativeWind** or
  `StyleSheet.create`. No inline style object literals in render (they
  re-allocate every render); hoist to `StyleSheet` or use class strings.
- **Design tokens in `src/theme`**, no raw values in components; dark mode from day one.
- **Safe areas via `react-native-safe-area-context`**; never hardcode insets.

### Lists, images, performance
- **Lists use `@shopify/flash-list`** with `estimatedItemSize`, stable `keyExtractor`,
  memoised `renderItem`, and no anonymous inline components. `ScrollView` only
  for short static content.
- **Images use `expo-image`** with `contentFit`, `cachePolicy`, a placeholder, and explicit sizes.
- **Hermes stays on.** Profile with the Hermes profiler before optimising.
- **Animations on the UI thread**: `react-native-reanimated` worklets and
  `react-native-gesture-handler`; no `Animated` with `useNativeDriver: false`,
  no `setState` per frame.
- **Avoid re-renders**: select slices from stores (`useStore(s => s.x)`),
  `React.memo` on list rows, no context for high-frequency values.

### Native modules
- **Native code only via the Expo Modules API** in `modules/` (Swift/Kotlin),
  or a config plugin for third-party native libs. `ios/` and `android/` are
  generated by prebuild and git-ignored; never edit them by hand.
- **Every native change bumps `runtimeVersion`** (policy `appVersion` or
  `fingerprint`) and ships through a store build, never through EAS Update.

### Builds and updates
- **EAS Build profiles**: `development` (dev client, internal distribution),
  `preview` (internal, production-like), `production` (store). Environment
  variables via `eas.json` `env` or EAS secrets; never committed.
- **OTA policy (EAS Update)**: JS-only changes may ship OTA to the channel
  matching the build profile; **never ship native changes, permission changes,
  or `app.config` changes OTA**. Every OTA is tagged, has a rollout percentage,
  and a rollback plan (`eas update:republish`). Updates are checked on launch
  with a bounded fallback timeout.

### Accessibility and platform behaviour
- **Every interactive element has `accessibilityRole`, `accessibilityLabel`
  (when not inferable), and `accessibilityState`**; touch targets at least
  44x44 pt; layouts survive 200 percent font scale.
- **Permissions requested at point of use** with `expo-*` permission hooks and a
  rationale screen; usage strings and `android.permissions` declared in
  `app.config.ts` only for what is actually used.

### Forbidden
Manual `ios/`/`android/` edits, `AsyncStorage` for secrets, inline style objects
in hot render paths, `FlatList` for long lists, images without dimensions,
`Platform.OS` ladders instead of platform files, untyped navigation params, OTA
of native changes, disabling Hermes, `eas build` from a dirty working tree.

## Size limit overrides for React Native

| Scope | Limit | Reason |
|---|---|---|
| Screen component render | 80 lines | Same as core component limit; extract sections |
| `app.config.ts` | 200 lines | Plugin lists are declarative; split plugins into `config/plugins/` past that |

## Dependencies

- **`npx expo install`** for anything Expo manages (never `pnpm add` an Expo or RN
  package directly); `pnpm add` for pure JS libraries; `npx expo install --check`
  and `expo-doctor` in CI.
- **Prefer Expo SDK modules** (`expo-image`, `expo-secure-store`, `expo-file-system`,
  `expo-notifications`) before community packages; a community native package
  needs a config plugin and a justification in the PR (maintenance, New
  Architecture support, privacy manifest).
- **Audit** as in `typescript.mdc` (`pnpm audit`, `knip`); Expo SDK majors
  upgraded via `npx expo install --fix` in a dedicated PR.

## Testing

Unit and component tests live next to source; E2E flows in `e2e/`; screenshot
baselines in `__screenshots__/` per platform. Mock at boundaries only: HTTP
(msw), secure store, notifications, native modules via `jest.mock` of the Expo
module.

| Category | Tool | What it covers |
|---|---|---|
| Unit | Jest (`jest-expo`) | Hooks, stores, schemas, reducers, formatters |
| Property-based | fast-check | Parsers, money and date maths, deep-link parsing |
| Component | `@testing-library/react-native` (queries by role/label, `user-event`) | Every screen: states, actions, accessibility props |
| HTTP mocking | msw (node server in tests) | All API hooks; offline and error paths |
| Integration | Jest with in-memory query client + mocked storage | Query hooks, persistence, auth gate, router redirects |
| E2E | **Maestro** (default, YAML flows) or Detox, on **both iOS and Android** | Onboarding, auth, core journey, deep link, offline recovery |
| Device matrix | EAS `preview` builds on min and latest OS, phone + tablet (simulators in CI; cloud device lab per `PROJECT.md`) | Layout, permissions, push |
| Screenshot | Maestro screenshots or `react-native-owl`, light/dark, large font scale | Key screens per platform |
| Performance | Reassure render benchmarks, `react-native-performance` marks, startup time tracked in Sentry | Startup, list scroll, navigation transitions |
| Security | `pnpm audit`, `expo-doctor`, manifest and permissions diff review | Every release |

Rules:
- **Every state of a screen (loading, empty, error, offline, loaded) has a test.**
- **E2E runs on both platforms** on release PRs; unit and component tests in
  `pnpm check` on every push.
- **Crash-free rate and JS errors tracked with `@sentry/react-native`** (source
  maps uploaded by the EAS build hook, release and `dist` set per update); a
  release is blocked below the threshold in `PROJECT.md`.

## Security specifics

- **Secrets in `expo-secure-store` only** (tokens, refresh tokens); `AsyncStorage`
  and zustand persist hold non-sensitive data. `EXPO_PUBLIC_*` variables are
  public by definition; nothing sensitive in the JS bundle.
- **TLS only**: ATS and `usesCleartextTraffic=false` untouched; certificate
  pinning via a config plugin where `PROJECT.md` requires it.
- **Deep-link inputs validated with a schema**; never navigate to arbitrary
  URLs from a link; universal links preferred over custom schemes for auth.
- **Privacy manifests**: iOS `PrivacyInfo.xcprivacy` required-reason APIs set via
  config; Android data safety form matches real SDK behaviour; consent via
  `expo-tracking-transparency` before any tracking SDK initialises.
- **No PII in Sentry breadcrumbs or logs**; scrub with `beforeSend`.
- **OTA supply chain**: EAS Update code signing enabled; only CI publishes
  updates from the release branch.

## Checklist when touching React Native code

- [ ] Expo-managed packages installed with `npx expo install`; `expo-doctor` clean
- [ ] Routes thin, typed, params validated; deep links declared and tested
- [ ] Server state in TanStack Query, client state in zustand/context, secrets in secure store
- [ ] No inline style churn; tokens from theme; dark mode and safe areas handled
- [ ] FlashList for lists, expo-image with sizes, reanimated on UI thread
- [ ] Accessibility role/label/state present; 44pt targets; font scaling survives
- [ ] Native changes only via Expo Modules or config plugins; `runtimeVersion` bumped
- [ ] OTA only for JS changes; rollout and rollback plan stated in the PR
- [ ] Permissions and privacy manifest match real usage
- [ ] Component tests per screen state; Maestro/Detox flow on both platforms if a journey changed
- [ ] `pnpm check` passes

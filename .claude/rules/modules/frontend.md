---
description: Web frontend — component design, state placement, forms, accessibility (WCAG 2.2 AA), Core Web Vitals, tokens and styling, i18n hooks, client security, and frontend testing. Framework-agnostic.
paths:
  - "**/*.tsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/components/**"
  - "**/*.css"
---

# Frontend

## When this applies

Apply to every file matching the globs and whenever `PROJECT.md` declares a web
UI. The rules are framework-agnostic; the actual framework, router, data
library, styling choice (Tailwind or CSS modules), and supported browsers live in
`PROJECT.md`. Size limits, layering (UI -> hooks -> logic -> data), and the
"no data fetching in effects" rule come from `core/code-standards.mdc`.

Data access from the UI (query layer, optimistic mutations, caching) is governed by `data-fetching.mdc`.
Shared components, tokens, themes, iconography, and their enforcement are
governed by `design-system.mdc`; read it whenever building or changing UI.

## Principles

- **Accessibility is a requirement, not a feature.** A screen that fails WCAG 2.2
  AA is a failing build.
- **Semantic HTML first.** Use the native element before reaching for ARIA or a
  custom widget.
- **State lives where it is owned.** Server data, client UI state, and URL state
  are different things and never share a store.
- **Performance is budgeted.** Every page has a bundle and Core Web Vitals budget
  checked in CI, not discovered in production.
- **Nothing user-facing is hardcoded**: strings, colors, spacing, and breakpoints
  all come from a single source (locale files, design tokens).

## Rules

### Components

- **One responsibility per component**; render output stays under 80 lines
  (`core/code-standards.mdc`). Extract sub-components before adding branches.
- **Props are typed and explicit.** No `any`, no spreading unknown objects into
  DOM elements, no `props: object`.
- **No boolean prop explosion.** Three related booleans (`isSmall`, `isLarge`,
  `isOutline`) become one `variant` / `size` union. Mutually exclusive states are
  a single discriminated union, never several flags.
- **Composition over configuration**: prefer `children` and slot components
  (`<Card.Header>`) to a growing list of `renderX` / `showX` props.
- **Presentational and container concerns are separate files**; a component
  either renders or orchestrates data, not both.
- **Every exported component has a Storybook story** (or the framework
  equivalent) covering each variant and its loading, empty, and error states.

### State placement

| State kind | Examples | Lives in |
|---|---|---|
| Server state | entities, lists, session | query library cache or server components; never copied into a client store |
| Client UI state | open modal, drafts, toggles | component state or a small store, scoped to the feature |
| URL state | filters, pagination, selected tab | the URL (search params); shareable and back-button safe |
| Form state | field values, touched, errors | the form library, discarded on unmount |

- **Never duplicate server state** into local state "for convenience"; derive it.
- **Global stores hold only truly global state** (theme, current user id, feature
  flags). Feature state stays colocated with the feature.

### Forms

- **Schema-driven**: one schema (the same one the server validates with, from the
  central schema location) drives field validation, types, and error messages.
- **Errors are accessible**: each field has a visible label, `aria-invalid`, and
  an error message linked with `aria-describedby`; on submit failure, focus moves
  to the first invalid field and a summary is announced.
- **Mutation feedback follows `data-fetching.mdc`**, the authoritative policy
  for optimistic eligibility, pending states, rollback, and confirmation.
- **Never lose user input** on a failed submit; preserve values and show the
  server's field-level `details` next to the fields.

### Accessibility (WCAG 2.2 AA)

- **Semantic elements**: `button` for actions, `a` for navigation, `nav`, `main`,
  `header`, `footer`, `h1`-`h6` in order, `ul` for lists, `table` for tabular data.
  A `div` with a click handler is a defect.
- **Keyboard**: every interactive element reachable and operable with keyboard
  only; visible focus ring (never `outline: none` without a replacement); no
  keyboard traps; `Escape` closes overlays.
- **Focus management**: opening a dialog moves focus inside and traps it; closing
  returns focus to the trigger; route changes move focus to the new main heading.
- **ARIA only when HTML cannot express it.** No ARIA is better than wrong ARIA.
  Custom widgets follow the WAI-ARIA Authoring Practices pattern exactly.
- **Text alternatives**: every image has `alt` (empty for decorative); icon-only
  buttons have an accessible name; form controls have programmatic labels.
- **Color**: contrast >= 4.5:1 for text, >= 3:1 for large text and UI parts; color
  is never the only carrier of meaning.
- **Motion**: honor `prefers-reduced-motion`; no auto-playing animation over 5 s
  without a pause control.
- **Targets**: pointer targets at least 24 x 24 CSS px (WCAG 2.2 2.5.8).
- **Live regions** announce async results (toasts, search counts) with
  `aria-live="polite"`; errors use `role="alert"`.
- **Lint and test it**: `eslint-plugin-jsx-a11y` (or the framework's a11y lint) at
  error level; axe runs in component tests and E2E (see Testing).

### Performance

Targets at p75 on real devices (override only upward in `PROJECT.md`): **LCP
< 2.5 s, INP < 200 ms, CLS < 0.1**.

- **Bundle budgets** per route are declared in the bundler config and enforced in
  CI (for example 200 kB gzipped initial JS; the exact figure is in `PROJECT.md`).
  A budget breach fails the build.
- **Code-split by route and by heavy component**; below-the-fold and
  interaction-only code loads lazily.
- **Images**: modern formats, explicit `width` / `height` (or aspect ratio) to
  prevent CLS, responsive `srcset`, lazy loading except the LCP image, which is
  preloaded with high fetch priority.
- **Fonts**: self-hosted or preconnected, subset, `font-display: swap` with a
  metric-matched fallback; at most two families.
- **Third-party scripts load after consent and after interaction or idle**, never
  render-blocking; each one has a named owner and a documented purpose.
- **No layout thrash**: never read layout (`offsetHeight`, `getBoundingClientRect`)
  and write styles in the same frame in a loop; animate `transform` and
  `opacity` only.
- Backend and caching budgets live in `modules/performance.mdc`.

### Design tokens and styling

- Follow `design-system.mdc` for semantic tokens, shared component reuse,
  supported themes, allowed structural/runtime values, and documented exceptions.
- Breakpoints derive from the token source at build time; do not use CSS
  custom properties as media-query conditions.
- **One styling approach per project** (Tailwind or CSS modules, per
  `PROJECT.md`). No inline style objects except for values computed at runtime.
- **No global overrides**: no unscoped element selectors after the reset, no
  `!important`, no reaching into another component's classes.

### i18n hooks

- **No hardcoded user-facing strings**, including `alt`, `aria-label`,
  placeholders, and `title`. Everything goes through the translation function
  with a key; rules for keys, plurals, dates, and RTL are in `modules/i18n.mdc`.
- **Use logical CSS properties** (`margin-inline-start`, not `margin-left`) so
  RTL works without overrides.

### Error boundaries and loading states

- **An error boundary wraps every route and every independently-failing widget**;
  it reports to the error tracker (`modules/observability.mdc`) and renders a
  retry action, never a blank screen.
- **Every async region has an explicit loading, empty, and error state**;
  skeletons match the final layout size to avoid CLS.

### Security

- **No raw HTML injection** (`dangerouslySetInnerHTML`, `v-html`, `{@html}`)
  without sanitizing through a trusted library; the lint rule for it is at error
  level and exceptions are documented inline.
- **CSP-friendly**: no inline scripts or `eval`; use nonces or hashes when a
  framework needs inline styles; external resources on an allowlist.
- **Tokens never in `localStorage`** (`core/security.mdc`); client code never
  imports server-only modules.
- **Untrusted URLs are validated** before use in `href` / `src` (`javascript:`
  and `data:` schemes rejected); external links get `rel="noopener"`.

### Analytics and consent

- **No tracking, pixel, or session replay loads before consent** for its category.
  Consent state is read from one module; every analytics call goes through it.
- **Analytics events are typed** (name + payload schema) in one file; no ad-hoc
  string events. Payloads carry ids, never PII.

### Tooling

- **Formatter** Prettier; **linter** ESLint with the framework plugin and
  `eslint-plugin-jsx-a11y` (or `eslint-plugin-vue-a11y` / Svelte's built-in a11y
  warnings at error level); **type checker** `tsc --noEmit`; **CSS lint** Stylelint
  with a no-magic-values rule; **test runner** Vitest (or Jest) with Testing
  Library and `jest-axe` / `vitest-axe`; **E2E** Playwright; **stories** Storybook.
- **Single check command**: the project's `check` script (for example
  `pnpm check`) runs typecheck, lint, stylelint, unit and component tests.

## Testing

- **Component tests** (Testing Library): query by role and accessible name, never
  by test id unless no accessible handle exists; cover each variant, loading,
  empty, and error state, and keyboard interaction.
- **Accessibility tests**: `axe` on every story or component test render and on
  each E2E page; zero violations at `serious` or `critical`.
- **Visual regression**: Playwright screenshots or Chromatic on every story, in
  light and dark theme; diffs require explicit approval.
- **E2E critical journeys** (Playwright): the flows listed in `PROJECT.md`
  (sign-in, primary conversion, checkout or equivalent), run against a preview
  deployment with mocked third parties only where the real one is unsafe.
- **Lighthouse CI** on key pages with budgets for LCP, INP (via lab TBT proxy),
  CLS, and total bytes; budget breach fails the pipeline.
- **Cross-browser matrix**: latest two versions of Chromium, Firefox, WebKit, plus
  iOS Safari and Android Chrome; the matrix and any exclusions are in `PROJECT.md`.
- **Responsive checks**: E2E and visual tests run at the token breakpoints
  (mobile, tablet, desktop at minimum).
- **Storybook stories are living docs**: every exported component has one; the
  story build runs in CI and broken stories fail it.
- **Unit tests** for hooks, formatters, and state logic with property-based
  cases (`fast-check`) for anything parsing or formatting.

## Checklist when touching frontend code

- [ ] Component does one thing; render under 80 lines; props typed, no boolean explosion
- [ ] Server, client, URL, and form state each live in their designated place
- [ ] Forms are schema-driven with accessible, field-linked errors and preserved input
- [ ] Semantic HTML; keyboard operable; focus managed; ARIA only where required
- [ ] Contrast, reduced motion, target size, and text alternatives verified
- [ ] No hardcoded strings, colors, or spacing; tokens and translation keys used
- [ ] Bundle budget respected; heavy code split; images sized; LCP asset preloaded
- [ ] Loading, empty, and error states present; error boundary reports to tracker
- [ ] No unsanitized HTML injection; CSP-safe; no tokens in `localStorage`
- [ ] No tracking before consent; analytics events typed and PII-free
- [ ] Story added or updated; axe, visual, and component tests pass
- [ ] Lighthouse CI and E2E critical journeys green on the preview

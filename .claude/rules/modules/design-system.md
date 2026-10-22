---
description: Shared design system — semantic tokens, reusable components, variants, themes, iconography, catalogue, and automated enforcement. Apply when building or changing UI or styles.
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.sass"
  - "**/*.less"
  - "**/*.svg"
  - "**/components/**"
  - "**/tokens/**"
  - "**/themes/**"
---

# Design System

## When this applies

Apply whenever the project has a UI, including component styles, utility
classes, CSS-in-JS, SVG, and native styling equivalents. Read this rule when
`PROJECT.md` activates `design-system` or the task touches these concerns.
Framework-specific implementation belongs in the language/platform rules;
web accessibility, forms, and performance remain in `frontend.mdc`.

## One shared source

- **One design system per project.** Declare the token source, shared component
  location, styling approach, catalogue, themes, and icon library in
  `PROJECT.md`. Multiple apps share a package when they share the same system.
- Tokens, components, variants, and usage conventions have one maintained
  source. Generated CSS, framework configuration, or native constants derive
  from it; never maintain duplicate values by hand.
- Every screen uses this system. Do not create a parallel set of controls,
  styles, or tokens for a new page or feature.
- Before introducing a token or component, search the source and catalogue
  for an existing equivalent. Reuse it or extend its documented API.

## Tokens and values

- **No hardcoded design values in component or page code.** Colors, spacing,
  typography (families, sizes, weights, line heights, letter spacing), radii,
  border widths, shadows, opacity levels, z-index layers, breakpoints, standard
  sizes, and animation durations/easings come from central tokens.
- Raw design values are defined only in the token source. Components consume
  semantic roles such as `color-text-primary`, `color-surface`, and
  `color-border-danger`; the semantic layer may reference primitive scales.
- Token names express a reusable role or scale, never a particular page or a
  temporary visual fix. Do not create an alias merely to disguise a magic value.
- Expose tokens through CSS custom properties or the platform's equivalent.
  Breakpoints used in media queries must use generated/build-time values from
  the token source; CSS custom properties do not substitute media conditions.
- Utility classes must resolve to the approved tokens. Arbitrary literals
  such as `bg-[#123456]`, `p-[13px]`, and raw palette colors in page code are
  forbidden. Arbitrary syntax that references an approved token is allowed.
- The same restriction applies to style objects, CSS-in-JS, animation code,
  chart styling, and SVG fills/strokes. A different syntax is not an exemption.
- Themes redefine semantic tokens; components do not branch on the current
  theme to select colors or other visual values. Theme selection belongs at
  the theme provider or root. Support only the themes declared in `PROJECT.md`.

### Allowed structural and runtime values

- Structural values such as `0`, `auto`, `100%`, `inherit`, `currentColor`, and
  layout keywords are allowed when they express layout or inheritance rather
  than a new visual choice. Do not tokenize every CSS keyword.
- Values calculated from runtime data (progress, pointer position, measured
  dimensions, chart coordinates) are allowed. Keep calculations separate from
  fixed design choices; those choices still use tokens.
- Intrinsic asset dimensions and SVG geometry are asset data. Standard display
  sizes and icon colors still follow the system.
- Any other exception requires a local explanation and an entry in the design
  system documentation naming its scope and reason. Temporary exceptions also
  carry a removal issue/date in `BACKLOG.md`; never silently widen an allowlist.

## Shared components and reuse

- **Reuse before creating.** Buttons, links, fields, dialogs, badges, cards,
  and other shared UI primitives use the project's common components.
  Screens must not rebuild their styling or interaction behavior locally.
- **Extend instead of copying.** Add a typed variant or compose existing
  components when a new use needs a different appearance or behavior. Never
  copy a component to change its color, size, or a few interactions.
- Variants describe supported intent and size. Avoid conflicting boolean
  props and arbitrary styling props that let consumers bypass the system.
- Components own their internal styling. Consumers may arrange them using
  documented layout APIs, but never target internal selectors or override
  their appearance with page-specific CSS or `!important`.
- Shared primitives are independent of page data, API calls, and business
  entities. Pass content and callbacks through explicit APIs; use composition
  for feature-specific content.
- **Reuse proportionately.** Common primitives are shared from the start.
  Business-specific compositions stay with their feature until a real shared
  need justifies extraction. Do not build speculative universal components
  with unrelated responsibilities or a growing configuration language.
- Wrap third-party UI where necessary to expose the project's tokens and
  supported API. Configure it centrally; do not repeat local theme patches.

## Catalogue and states

- Every shared component has a Storybook entry or framework equivalent with
  its public API, intended uses, variants, composition examples, and misuse
  guidance. Searchable examples are part of the component deliverable.
- Define applicable hover, focus-visible, active, disabled, loading, error,
  selected, empty, and success states in the shared component. Consumers do
  not invent their own state colors, spinners, or focus treatment.
- Catalogue examples cover every supported variant and applicable state,
  including long content and narrow layouts. Explain states that do not apply.
- Accessible behavior belongs to the shared primitive: keyboard interaction,
  focus management, names, and state announcements travel with reuse.
- Changes to tokens, variants, or component APIs update the catalogue in the
  same change. Deprecated APIs name their replacement and removal plan.

## Iconography

- One approved icon library and style per project, declared in `PROJECT.md`.
  Product-specific icons follow the same conventions and live centrally.
- Icons use standard size/stroke tokens and inherit `currentColor` where
  supported. No per-page icon colors, arbitrary sizes, or mixed icon families.
- Decorative icons are hidden from assistive technology. Icon-only controls
  have an accessible name on the control; a tooltip alone is insufficient.
- Brand illustrations and multicolor assets may retain intrinsic artwork
  colors when identified as assets, not used to bypass UI color tokens.

## Automated enforcement

- The project's check command and CI reject forbidden design literals and
  token bypasses. Cover stylesheet files, utility classes, style objects, and
  relevant SVG attributes with tooling appropriate to the stack.
- Configure token-source, generated-file, structural-value, and runtime-value
  exceptions narrowly. Do not exempt an entire component directory or all
  inline styles. Generated files must be checked against their source.
- Enforce public component imports and prohibit known duplicate primitive
  implementations or banned library imports where static rules can detect
  them. Review semantic duplication that static checks cannot reliably detect.
- Document the actual lint commands and test coverage in `TEST_PLAN.md`;
  naming a linter without configuring the restrictions is not enforcement.

## Testing

- Follow `core/testing.mdc` and the frontend testing requirements. Component
  tests cover variants, applicable states, keyboard behavior, and accessibility.
- Visual regression covers the catalogue across supported themes and viewport
  sizes. Expected visual changes require explicit review; never blindly
  regenerate all snapshots to make CI pass.
- Before changing a shared component or token, find its consumers. Verify
  affected variants and representative consuming screens; run the relevant
  journey tests when behavior changes. A token change can affect many screens.
- Validate semantic token references and theme completeness: no unresolved
  references, alias cycles, or missing required theme roles. Check contrast
  for supported text/surface and control/state combinations.
- Test enforcement configuration with representative forbidden and allowed
  examples so new style syntaxes cannot silently bypass checks.
- Build the catalogue in CI. Broken examples or unsupported public API usage
  fail the check, just like application code.

## Checklist when touching UI or styling

- [ ] Existing tokens and components searched before adding new ones
- [ ] Screen uses common primitives; no copied components or local restyling
- [ ] Design values come from semantic tokens or approved scales
- [ ] Structural/runtime values are genuine; other exceptions documented
- [ ] Variants are explicit; shared primitives are independent of page data
- [ ] Business compositions extracted only for a real shared need
- [ ] Applicable states and accessible behavior implemented centrally
- [ ] Catalogue documents APIs, variants, states, and intended usage
- [ ] Icons use the approved library, standard tokens, and accessible treatment
- [ ] Lint enforces restrictions across the styling syntaxes in use
- [ ] Affected consumers, themes, responsive layouts, and visual diffs verified
- [ ] Token validation, component tests, and catalogue build pass

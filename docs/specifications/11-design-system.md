# 11 — Design system: one design file, swappable UI kits

A host adopts the module without looking like a foreign body. **One design file** declares every visual decision (colors in light and dark, fonts, radius, spacing, brand) and drives the learner UI, the back-office, and the PDF and Word exports. The module draws its buttons, cards, fields, badges, alerts, progress bars and tables through a **UI kit**: a small typed interface with a plain default. A host swaps the kit for its own design system. **Theme 1 is shadcn/ui**, distributed as a shadcn registry and used by the demo. See [ADR-0002](../adr/0002-design-file-and-ui-kits.md).

Last updated: 2026-10-25

## Goals

- **Codified, not hand-tuned**: whoever takes over or installs the project reads one file, `elearning.design.ts`, and changing it changes every surface.
- **Graftable**: shadcn/ui is the first kit. Another host plugs its own (MUI, Chakra, an internal kit) without forking the module.
- **No imposed CSS stack**: the packages still ship plain CSS (spec 04, section 6), every rule in the `elearning` **cascade layer**: any unlayered host CSS and any later layer win over it. A Tailwind host declares the order once, before any CSS, so the module comes after Tailwind's reset and before its utilities: `@layer theme, base, elearning, components, utilities;`. The module sets its own type scale and lesson content flow, so a reset changes nothing. Tailwind and Radix are dependencies of the shadcn kit only.
- **Accessibility stays in the module**: labels, ARIA attributes, focus order and live regions are decided by the module and passed to the kit, which only draws.

## The design file

`defineDesign()` from `@bebranded/elearning-core/design` (pure, runs on server and client) validates and returns an `ElearningDesign`:

```ts
// elearning.design.ts — the only file to edit to restyle every surface.
import { defineDesign } from "@bebranded/elearning-core/design";

export default defineDesign({
  brand: { name: "Acme Corp training" },
  colors: {
    light: { background: "#ffffff", foreground: "#0a0a0a", primary: "#171717", primaryForeground: "#fafafa" /* … */ },
    dark: { background: "#0a0a0a", foreground: "#fafafa", primary: "#e5e5e5", primaryForeground: "#171717" /* … */ },
  },
  radius: "0.625rem",
  spacing: "0.25rem", // the unit: every gap, margin and padding is a step of it
  fonts: { body: "Inter, system-ui, sans-serif", heading: "Inter, system-ui, sans-serif", mono: "ui-monospace, monospace" },
  darkMode: "media", // "media" | "class" | "off"
});
```

| Group | Tokens | Notes |
|---|---|---|
| Colors (light, dark) | `background`, `foreground`, `card`, `cardForeground`, `primary`, `primaryForeground`, `secondary`, `secondaryForeground`, `muted`, `mutedForeground`, `accent`, `accentForeground`, `destructive`, `destructiveForeground`, `success`, `successForeground`, `warning`, `warningForeground`, `border`, `input`, `ring` | shadcn/ui's vocabulary, so a shadcn host maps one to one. `light` is complete; `dark` may be partial and falls back to `light` per token. |
| Shape | `radius` | A CSS length. |
| Spacing | `spacing` | The spacing unit, a CSS length above zero (default `0.25rem`). See [Spacing](#spacing). |
| Type | `fonts.body`, `fonts.heading`, `fonts.mono` | Font family lists. |
| Behavior | `darkMode` | `media` follows the system, `class` follows a `.dark` ancestor, `off` stays light. |
| Brand | `brand.name`, `brand.logo` (optional: a PNG, JPEG, GIF or WebP data URI; exports never fetch) | Export cover and footer. |

- **Validation**: only plain colors (`#hex`, `rgb()`, `hsl()`, `oklch()`), lengths and font names are accepted. Anything else is rejected with the token's name, never silently dropped, so CSS can never be injected through a design value.
- **Contrast**: `checkDesign(design)` returns a warning for every text pair below WCAG AA (4.5:1), in each scheme the design uses. A partial dark palette falls back to light tokens, which easily pairs light text with a light surface; the check catches it. The demo's tests require no warning.

### What the design file drives

| Surface | How |
|---|---|
| Module UI (learner, back-office, BlockNote editor) | `<ElearningProvider design={design}>` renders `designToModuleCss(design)`: the `--el-*` variables scoped to its root, light and dark per `darkMode` (a `nonce` prop serves a strict CSP). |
| The host's own shell | `designToShadcnCss(design)` returns a stylesheet with shadcn's variable names (`--background`, `--primary`…) for `:root` and `.dark`; the shadcn registry ships the same values as a `registry:theme`. |
| PDF export | `elearningExport({ design })`, through `designToExportTheme`: print CSS from the light colors as `#rrggbb`, fonts and brand. |
| Word export | Same option: heading and link colors, body and heading fonts. |

## Spacing

The design file owns spacing like it owns colors: one unit, and a fixed scale of steps derived from it.

| Step | Value | Tailwind equivalent |
|---|---|---|
| `--el-space-1` | 1 unit | `p-1` |
| `--el-space-2` | 2 units | `p-2` |
| `--el-space-3` | 3 units | `p-3` |
| `--el-space-4` | 4 units | `p-4` |
| `--el-space-5` | 5 units | `p-5` |
| `--el-space-6` | 6 units | `p-6` |
| `--el-space-8` | 8 units | `p-8` |

- **One knob**: `designToModuleCss` writes the unit as `--el-space-unit` on the module's root; the steps are computed from it in `base.css` (0.25rem without a design file). `designToShadcnCss` writes the same unit as `--spacing`, from which Tailwind v4 computes every spacing utility, so the host shell and the module move together. The registry's theme item carries it too.
- **Numbered like Tailwind**: `--el-space-4` and `p-4` are the same length with the default unit.
- **Only steps of the scale**: every `margin`, `padding`, `gap` and offset of the module's stylesheets is a step or zero. Other lengths (control heights, icon and handle sizes, borders) are sizes, not spacing, and stay as they are.
- **Vertical rhythm**: the module's blocks (course header, lesson, back-office sections, quiz panels) space their children one step 4 apart, whatever the host's CSS reset; headings keep the margins of the type scale. The first heading of the module starts flush, and empty back-office lists take no room.
- **Fields are one box**: every kit field renders its label above its control inside one element, so a row of fields lines up on their controls and the row's button on their baseline.
- **Wide content scrolls in place**: the module's root and its single-column grids may shrink below their content's width (`min-inline-size: 0`, `minmax(0, 1fr)`), so a wide table scrolls in its wrapper instead of widening a host page on mobile.
- **Enforced**: `packages/react/src/spacing.test.ts` fails on any literal length in a spacing property of the module's stylesheets and on any step the scale does not define; `apps/demo/lib/spacing.test.ts` fails on an arbitrary Tailwind spacing value (`p-[13px]`) in the demo shell.

`theme` on `<ElearningProvider>` and `elearningExport` (spec 04, section 6) is replaced by `design`. No package has been published yet, so there is no deprecation period.

## UI kits

`UiKit` (exported by `@bebranded/elearning-react`) lists the primitives the module draws. Each takes typed props and forwards `id`, `aria-*`, `disabled` and event handlers to its element:

| Primitive | Props | Default kit |
|---|---|---|
| `Button` | `variant: "primary" \| "secondary" \| "destructive" \| "ghost"`, `size: "sm" \| "md"`, `type`, `onClick`, `disabled`, `children` | `<button class="el-button …">` |
| `LinkButton` | `href`, `variant`, `children` | `<a class="el-button …">` |
| `Card` | `children`, `as?: "article" \| "section" \| "li"` | `<div class="el-card">` |
| `Badge` | `tone: "neutral" \| "success" \| "warning" \| "info"`, `children` | `<span class="el-tag">` |
| `Alert` | `tone: "error" \| "info" \| "success"`, `role`, `children` | `<div class="el-state …">` |
| `Progress` | `value` (0 to 1), `label` | `<progress>`-like bar with `role="progressbar"` |
| `TextField`, `TextArea` | `label`, `value`, `onChange`, `required`, `maxLength`, `pattern`, `disabled`; `TextField` also `list` (a `<datalist>` id) and `inputMode` | `<div class="el-field">` with `<label>` + `<input>` / `<textarea>` |
| `Select` | `label`, `value`, `options`, `onChange`, `disabled` | `<div class="el-field">` with `<label>` + `<select>` |
| `Checkbox` | `label`, `checked`, `onChange`, `disabled` | `<label>` + `<input type="checkbox">` |
| `Table` | `caption`, `columns`, `rows` | `<table>` with `<caption>` and `scope` headers |

- `<ElearningProvider ui={kit}>` takes a partial kit; missing primitives fall back to the default kit. The back-office (`<ElearningAdminProvider>`) uses the same kit.
- The module's own layout (outline, lesson page, editor chrome) keeps its plain CSS, styled by the `--el-*` variables.
- **Kit contract tests**: one shared suite renders every primitive of a kit (roles, names, disabled state, forwarded handlers, axe). It runs against the default kit and the shadcn kit, and is exported so any host can run it against its own kit.

## Theme 1: shadcn/ui

The demo publishes a **shadcn registry** at `https://e-learning.bebranded.xyz/r/`. `pnpm --filter @bebranded/elearning-demo registry` (part of the demo's build) writes it from `apps/demo/lib/registry/registry.ts` and the design file, in the format `shadcn build` produces, without the CLI's dependencies:

| Item | Type | What it installs |
|---|---|---|
| `elearning-design` | `registry:file` | `elearning.design.ts` at the project root, the demo's design as a starting point |
| `elearning-theme` | `registry:theme` | The design's colors, radius, spacing and fonts as shadcn CSS variables (light and dark) |
| `elearning-kit` | `registry:lib` | `lib/elearning-kit.tsx`, the `UiKit` drawn with shadcn components; it pulls in `button`, `card`, `badge`, `alert`, `progress`, `input`, `textarea`, `select`, `checkbox`, `label` and `table` |
| `elearning` | `registry:item` | All three at once |

A shadcn host runs `npx shadcn add https://e-learning.bebranded.xyz/r/elearning.json`, then passes `design` and `ui={elearningKit}` to the provider. Every value in the registry comes from the demo's `elearning.design.ts`; a test checks that the built theme item matches it. The kit and the design file need the `@bebranded/*` packages, so the one-command install works once they are published (B-003); the theme item installs today.

## The demo

- `apps/demo/elearning.design.ts` is the demo's single design source: Tailwind v4 and shadcn read the CSS from `designToShadcnCss`, the module reads `design`, and exports read it on the server.
- The shell (header, navigation, sign-in, catalog pages around the module) is built with shadcn/ui components, and the module runs with the shadcn kit.
- The header keeps the BeBranded logo and the link to the source code.

## Testing

- Core: design validation (each token kind, rejected values with their names, a zero or relative spacing unit), dark fallback, CSS generation (both naming schemes), contrast warnings, export theme mapping.
- Spacing: the stylesheet and demo-shell guards above, each with tests of what they catch and what they accept.
- React and admin: component tests run with the default kit and with a recording kit, proving every primitive goes through the kit; the kit contract suite on the default kit.
- Demo: the kit contract suite on the shadcn kit (fields in one box, `list` and `inputMode` forwarded); end-to-end journeys unchanged, plus axe on every page in light and dark; the registry build matches the design file.
- Exports: the layout checks of spec 10 with a custom design (colors and fonts reach the PDF; colors reach the Word XML).

## Authoring navigation and preview

The demo back-office uses a persistent left sidebar with a course outline and
course links. Its list scrolls independently on desktop and collapses behind a
labeled menu button on mobile. The main workspace groups structure, settings,
completion, access, tracking and preview into focused sections. Course cards
and lesson rows have full clickable areas; nested move controls remain separate
keyboard targets. Chapter summaries expand their lesson lists.

The package stylesheet entry imports `admin-base.css` before `workspace.css`
so workspace layout overrides follow the existing primitive styles. Every
color, spacing and border uses the shared design tokens. Hidden editor panels
stay mounted to retain drafts and remain absent from keyboard navigation.
Saved-content preview uses the learner renderer in a desktop or mobile frame,
with an explicit refresh action and no learner-state writes.

Verified layouts: [desktop](../screenshots/authoring-desktop.png) and
[mobile](../screenshots/authoring-mobile.png). Browser upload tests use a
synthetic video fixture; the normal demo seed uses attributed video excerpts.

## Navigation and authoring refinement

The demo header stays visible while scrolling. Its actual rendered height,
including wrapped controls and text zoom, defines the remaining admin viewport.
The sidebar fills that remaining height and scrolls independently of the main
content; the administration footer belongs to the main content pane. Mobile
navigation remains collapsible and fits within the available viewport.

Course creation has a dedicated route with initial settings, separate from the
catalog. Reusable catalog/navigation components accept an optional creation URL
and preserve the inline form behavior when omitted. Authoring sections use
keyboard-accessible tabs with active state, linked tab panels and arrow/Home/End
navigation. Panels preserve unsaved editor state when switching sections.

Chapter headers emphasize title, status and lesson count. Secondary actions live
in a named disclosure, and lesson creation expands on demand. Lists, creation
actions, chapter contents and forms have explicit token-based spacing, including
when a host uses a CSS reset. Course language uses a localized native selector
of ISO 639-1 language codes and preserves existing regional or legacy tags.
The catalog and labels are stored with the package: browser ICU data must not
remove options or change the server-rendered form during hydration.

Verified refinement layouts: [desktop](../screenshots/navigation-desktop.png),
[mobile](../screenshots/navigation-mobile.png) and
[course settings](../screenshots/navigation-settings.png). Chapter action panels
close after publication/reordering, outside clicks or Escape; Escape returns
focus to their trigger. Creation fields wait for client hydration before
accepting input so an early title edit cannot lose its generated slug.

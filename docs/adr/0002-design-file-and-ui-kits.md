# ADR-0002: One design file and swappable UI kits; shadcn/ui as theme 1

- **Status**: accepted
- **Date**: 2026-10-24
- **Deciders**: maintainers
- **Related**: `docs/specifications/11-design-system.md`, spec 04 section 6, `modules/design-system`, B-004, B-033

## Context

Hosts have their own design systems. The module styled itself with a handful of `--el-*` colors, the exports had their own colors and fonts, and the demo had hand-written CSS that looked unfinished. Nothing told a newcomer where visual decisions live, and a host could recolor the module but not make its buttons and fields look like its own.

## Decision

Every visual decision lives in one validated design file (`defineDesign`, in core), which drives the module's CSS variables, the host shell's CSS variables, and the PDF and Word exports. The module draws its primitives (button, card, badge, alert, progress, fields, table) through a typed `UiKit` with a plain default kit; hosts pass their own. shadcn/ui is the first kit, published as a shadcn registry and used by the demo. The design tokens use shadcn's vocabulary.

## Options considered

| Option | Pros | Cons | Cost / effort |
|---|---|---|---|
| Design file + UI kit (chosen) | One file to read; graftable components; accessibility stays in the module; no CSS stack imposed | A kit interface to keep small and stable | Medium |
| Design file only | Simple | Hosts can recolor but not match their components | Low |
| Rewrite the module in shadcn/Tailwind | Fast good looks | Forces Tailwind and Radix on every host; not swappable | Medium, and a dead end |

## Consequences

- **Positive**: one file restyles every surface; the shadcn registry installs a working setup with one command; a contract test suite lets any host verify its own kit.
- **Negative / accepted trade-offs**: the kit interface is public API (semver); primitives the module needs later extend it in a minor version, with a default.
- **Follow-ups**: `theme` props are replaced by `design` (nothing published yet); B-033 (dark mode, contrast warnings) is delivered by this work; B-004 is resolved.

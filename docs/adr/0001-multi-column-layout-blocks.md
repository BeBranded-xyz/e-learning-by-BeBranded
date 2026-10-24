# ADR-0001: Multi-column layout on BlockNote's layout block API

- **Status**: accepted (go of the phase 4b spike); the maintainers may reverse it in review
- **Date**: 2026-10-24
- **Deciders**: maintainers (decision proposed by the spike)
- **Related**: `docs/specifications/10-editor-extensions.md` ("Multi-column layout", "Risk"), `docs/specifications/09-roadmap.md` (phase 4b)

## Context

Spec 10 plans a time-boxed spike before building multi-column lessons: nested
containers, drag and drop between columns, and cursor movement are hard in
ProseMirror, and BlockNote's own multi-column package is GPL or commercial,
so it cannot be used or read (clean room). The fallback is a simpler layout
block: columns edited one at a time, with no drag and drop between them.

BlockNote's MPL-2.0 core (0.56, already a dependency) has a public, generic
**layout block** API: a block declared `layoutOnly` has no content of its
own and holds child blocks; `children.allow` names which layout blocks it
holds and how many at least, `dissolve` unwraps it when too few remain,
`placeable: "namedOnly"` keeps a block inside its parent only, and
`exclude` keeps a block type out. `renderFrame` draws the block's chrome
around a slot where BlockNote mounts the children.

## Decision

We build `columnList` and `column` as our own block specs on that public
API: a list holds 2 to 4 columns (`allow: ["column"]`, `min: 2`, dissolving
into its blocks below two), a column is placeable only in a list and holds
any block except a column list. Our JSON format is our own and matches
spec 10's data model. **Go** on the full implementation; the fallback is
not needed.

## Options considered

| Option | Pros | Cons | Cost / effort |
|---|---|---|---|
| Layout block API of BlockNote's MPL core (chosen) | Nesting, drag and drop, cursor movement, undo and schema enforcement come from the editor; public API; no GPL code involved | API marked as recent in 0.56; behavior can move between BlockNote versions | Small: two specs, validation, renderers, editor chrome (resize) |
| Our own ProseMirror node specs | Full control | Rebuilding what BlockNote already ships, high risk on drag and drop and cursor behavior | High |
| Fallback: one-column-at-a-time layout block | Simple | Poor editing, no drag and drop between columns | Medium |

## Consequences

- **Positive**: the spike's three questions (nested blocks, removal and
  dissolving, refusal of nested lists) passed on a headless editor in the
  first session; resizing, undo and the slash items are tested on a
  mounted editor.
- **Negative / accepted trade-offs**: we depend on a recent BlockNote API;
  every BlockNote upgrade reruns the column tests. Widths are stored as
  ratios and rendered in 5% steps, so the learner page and exports need no
  inline styles (strict CSP).
- **Follow-ups**: creating columns by dragging a block onto another
  block's edge (B-061), browser journeys on desktop and mobile (B-062), a
  localized name for the resize handle (B-063). Spec 10 records the
  behavior. Quiz lessons have no columns.

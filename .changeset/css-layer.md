---
"@bebranded/elearning-react": minor
"@bebranded/elearning-admin": minor
---

The module's stylesheets sit in the `elearning` cascade layer, so any unlayered host CSS and later layers win; a Tailwind host orders them with `@layer theme, base, elearning, components, utilities;`. The module sets its own heading scale and lesson content flow (lists, spacing), so a host's CSS reset changes nothing.

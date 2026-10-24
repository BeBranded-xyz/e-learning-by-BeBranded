---
"@bebranded/elearning-react": minor
"@bebranded/elearning-admin": minor
---

UI kits (spec 11): the learner components and the back-office draw their buttons, cards, badges, alerts, progress bars, fields and tables through a `UiKit` (`useUi`, `defaultKit`). `<ElearningProvider design nonce ui>` applies a design file's variables (light and dark) and a host kit; the `theme` prop is replaced by `design`. Every color token has a default; muted text now reads `--el-color-muted-foreground` (`--el-color-muted` is the muted surface).

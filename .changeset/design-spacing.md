---
"@bebranded/elearning-core": minor
"@bebranded/elearning-react": minor
"@bebranded/elearning-admin": minor
---

Spacing comes from the design file (spec 11): `defineDesign` takes a `spacing` unit (default `0.25rem`), written as `--el-space-unit` for the module and `--spacing` for a Tailwind shell. The stylesheets space everything with the scale `--el-space-1` to `--el-space-8`, which replaces `--el-space`. The module's blocks keep a vertical rhythm under any CSS reset, kit fields render as one box (`el-field`) and `TextField` forwards `list` and `inputMode`, callout bars stay straight, and a wide table no longer widens a host page on mobile.

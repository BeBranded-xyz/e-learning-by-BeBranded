---
"@bebranded/elearning-export": minor
"@bebranded/elearning-core": minor
"@bebranded/elearning-editor": patch
---

New package `@bebranded/elearning-export`: `elearningExport()` renders lessons and courses to Word (with `docx`) and PDF (sanitized HTML printed by headless Chromium). PDF adapters take the host's own browser library: `playwrightPdf`, `puppeteerPdf` (serverless Chromium, Cloudflare Browser Rendering) and `gotenbergPdf`; each disables JavaScript and blocks every network request. Images are read through `FileStorage.read` and inlined; exports are bounded in size, time and concurrency. Core adds the `DocumentExporter` port and the optional `FileStorage.read`.

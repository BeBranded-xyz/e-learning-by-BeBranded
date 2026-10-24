# @bebranded/elearning-export

Server-only PDF and Word export of the BeBranded e-learning module (spec 10).
Lessons and courses are rendered from one export tree: Word files with the
`docx` library, PDFs from sanitized HTML printed by headless Chromium.

```sh
pnpm add @bebranded/elearning-export
```

The package bundles no browser. Pick the adapter that fits your
infrastructure and install its library yourself:

```ts
import { elearningExport, playwrightPdf } from "@bebranded/elearning-export";
import { chromium } from "playwright-core"; // Node servers

import design from "./elearning.design"; // your design file (spec 11)

export const exporter = elearningExport({
  pdf: playwrightPdf({ launch: () => chromium.launch() }),
  design, // colors, fonts and the brand's logo of PDF and Word files
});
```

| Adapter | For | Library you install |
|---|---|---|
| `playwrightPdf({ launch })` | Node servers, containers | `playwright-core` |
| `puppeteerPdf({ launch })` | Vercel and other serverless platforms | `puppeteer-core` + `@sparticuz/chromium` |
| `puppeteerPdf({ launch: () => puppeteer.launch(env.BROWSER) })` | Cloudflare Browser Rendering | `@cloudflare/puppeteer` |
| `gotenbergPdf({ url })` | A Gotenberg container | none (HTTP) |

Without `pdf`, only Word export is offered.

- Every adapter disables JavaScript and blocks every network request of the
  page; images are read beforehand through your `FileStorage.read` and
  inlined. Run Gotenberg with its Chromium deny list blocking every URL.
- Limits: 20,000 blocks, 200 images and 25 MB of images per export, a 30 s
  rendering deadline (`timeoutMs`), 2 renders at once with 8 waiting
  (`maxConcurrent`, `maxQueued`); beyond, `export_busy` (429).
- Pages are A4, or Letter for `en-US` and `en-CA` (`pageSize: "auto"`, the
  default). Word embeds PNG, JPEG and GIF images; WebP images become a
  link to the lesson.
- Supported: Node 22.12 or later.

// Usage: pnpm --filter @bebranded/elearning-demo registry
// Writes the demo's shadcn registry to public/r/ (spec 11): an index and one
// JSON per item, files inlined, the theme taken from elearning.design.ts. It is
// the format `shadcn build` writes, without the CLI's dependencies.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { design } from "../elearning.design.js";
import { registryFromDesign } from "../lib/registry/registry.js";

const OUT = "public/r";
const registry = registryFromDesign(design);

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`);
for (const item of registry.items) {
  const files = item.files?.map((file) => ({ ...file, content: readFileSync(file.path, "utf8") }));
  const json = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    ...item,
    ...(files === undefined ? {} : { files }),
  };
  writeFileSync(path.join(OUT, `${item.name}.json`), `${JSON.stringify(json, null, 2)}\n`);
}
process.stdout.write(`public/r: ${String(registry.items.length)} items from elearning.design.ts\n`);

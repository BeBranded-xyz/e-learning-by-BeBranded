import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { checkArchitecture } from "./architecture.mjs";

const files = new Map();
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.posix.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !["node_modules", "tests", "scripts", "dist"].includes(entry.name) &&
      !entry.name.startsWith(".")
    )
      collect(file);
    else if (entry.isFile() && /\.tsx?$/.test(file) && !/\.(test|gen)\.tsx?$/.test(file))
      files.set(file, readFileSync(file, "utf8"));
  }
}
const manifests = {};
for (const name of readdirSync("packages")) {
  manifests[name] = JSON.parse(readFileSync(`packages/${name}/package.json`, "utf8"));
  collect(`packages/${name}/src`);
}
collect("apps/demo/app");
collect("apps/demo/components");
collect("apps/demo/lib");
collect("apps/demo/registry");
const errors = checkArchitecture(files, manifests);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log(`Architecture: ${files.size} source files checked.`);

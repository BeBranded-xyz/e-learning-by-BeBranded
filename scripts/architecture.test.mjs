import assert from "node:assert/strict";
import { test } from "node:test";

import { checkArchitecture } from "./architecture.mjs";

const manifests = Object.fromEntries(
  ["core", "react", "server", "admin"].map((name) => [
    name,
    {
      exports: { ".": { "@bebranded/source": "./src/index.ts" } },
      dependencies: name === "core" ? {} : { "@bebranded/elearning-core": "workspace:^" },
    },
  ]),
);
const check = (entries, packages = manifests) =>
  checkArchitecture(new Map(Object.entries(entries)), packages);

test("accepts public allowed dependencies and type-only server references in the host", () => {
  assert.deepEqual(
    check({
      "packages/react/src/index.ts": 'import { value } from "@bebranded/elearning-core";',
      "packages/core/src/index.ts": "export const value = 1;",
      "apps/demo/components/client.tsx":
        '"use client"; import type { Server } from "@bebranded/elearning-server";',
    }),
    [],
  );
});

test("rejects private imports, relative boundary escapes and forbidden manifest dependencies", () => {
  assert.match(
    check({
      "packages/react/src/index.ts":
        'import "../../core/src/private.js"; import "@bebranded/elearning-core/src/private";',
    }).join("\n"),
    /cross-package relative/,
  );
  assert.match(
    check({
      "packages/react/src/index.ts": 'import "@bebranded/elearning-core/src/private";',
    }).join("\n"),
    /private or unknown/,
  );
  assert.match(
    check({}, { core: { dependencies: { "@bebranded/elearning-server": "workspace:^" } } }).join(
      "\n",
    ),
    /forbidden dependency/,
  );
});

test("rejects transitive server imports through re-exports and dynamic imports", () => {
  const result = check({
    "apps/demo/components/client.tsx": '"use client"; import "../lib/helper.js";',
    "apps/demo/lib/helper.ts": 'export * from "./deep.js";',
    "apps/demo/lib/deep.ts": 'const server = import("@bebranded/elearning-server");',
  });
  assert.match(
    result.join("\n"),
    /client reaches @bebranded\/elearning-server through apps\/demo\/lib\/deep.ts/,
  );
});

test("rejects Node builtins and computed imports reachable from a client entry", () => {
  assert.match(
    check({ "packages/react/src/index.ts": 'import "fs";' }).join("\n"),
    /client reaches fs/,
  );
  assert.match(
    check({ "packages/react/src/index.ts": "import(target);" }).join("\n"),
    /computed import/,
  );
});

test("recognizes a client directive after a comment and keeps core framework-independent", () => {
  assert.match(
    check({
      "apps/demo/components/client.tsx": '/* license */ "use client"; import "node:fs";',
    }).join("\n"),
    /client reaches node:fs/,
  );
  assert.match(
    check({ "packages/core/src/index.ts": 'import "react";' }).join("\n"),
    /framework-independent/,
  );
});

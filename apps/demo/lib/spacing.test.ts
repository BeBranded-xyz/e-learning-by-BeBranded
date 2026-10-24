// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The shell spaces with Tailwind's scale, computed from the design file's
// spacing unit (`--spacing`, spec 11). An arbitrary value such as `p-[13px]`
// steps out of the design system.

const DEMO = fileURLToPath(new URL("../", import.meta.url));
const SPACING_UTILITY =
  /(?<![\w-])-?(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left)-\[[^\]]+\]/g;

/** Tailwind spacing utilities written with an arbitrary value. */
function arbitrarySpacing(source: string): string[] {
  return [...source.matchAll(SPACING_UTILITY)].map(([utility]) => utility);
}

function sources(dir: string): { readonly file: string; readonly source: string }[] {
  return readdirSync(join(DEMO, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
    .map((name) => ({
      file: `${dir}/${name}`,
      source: readFileSync(join(DEMO, dir, name), "utf8"),
    }));
}

const FILES = ["app", "components", "registry"].flatMap(sources);

describe("arbitrarySpacing", () => {
  it("finds arbitrary spacing values", () => {
    expect(arbitrarySpacing('className="p-[13px] mt-[2rem] -mx-[3px] gap-x-[1ch]"')).toEqual([
      "p-[13px]",
      "mt-[2rem]",
      "-mx-[3px]",
      "gap-x-[1ch]",
    ]);
  });

  it("accepts the scale and arbitrary values outside spacing", () => {
    expect(
      arbitrarySpacing(
        'className="p-4 gap-1.5 -mt-2 ring-[3px] translate-y-[2px] grid-cols-[0_1fr]"',
      ),
    ).toEqual([]);
  });
});

describe("the demo shell", () => {
  it("has components to check", () => {
    expect(FILES.map(({ file }) => file)).toEqual(
      expect.arrayContaining(["app/layout.tsx", "components/ui/button.tsx"]),
    );
  });

  it.each(FILES)("$file spaces with the design's scale only", ({ source }) => {
    expect(arbitrarySpacing(source)).toEqual([]);
  });
});

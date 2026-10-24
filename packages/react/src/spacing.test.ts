/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The design system owns spacing (spec 11): every gap, margin, padding and
// offset of the module's stylesheets is a step of the scale in base.css,
// itself derived from the design's spacing unit. A literal length is drift.

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const SPACING_PROPERTY =
  /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left)(-[a-z-]+)?$/;
const LITERAL_LENGTH = /(?<![\w-])-?\d*\.?\d+(px|rem|em|%|vh|vw|ch)\b/;

type Declaration = { readonly property: string; readonly value: string };

function declarations(css: string): Declaration[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...code.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map(([, property = "", value = ""]) => ({
    property,
    value: value.trim(),
  }));
}

/** Spacing declarations written with a literal length instead of a step of the scale. */
function literalSpacing(css: string): string[] {
  return declarations(css)
    .filter(({ property, value }) => SPACING_PROPERTY.test(property) && LITERAL_LENGTH.test(value))
    .map(({ property, value }) => `${property}: ${value}`);
}

/** The `--el-space-*` steps a stylesheet uses. */
function usedSteps(css: string): string[] {
  return [...css.matchAll(/var\((--el-space-[\w-]+)\)/g)].map(([, name = ""]) => name);
}

function stylesheets(): { readonly file: string; readonly css: string }[] {
  return ["react", "admin"].flatMap((pkg) => {
    const dir = join(PACKAGES, pkg, "src");
    return readdirSync(dir)
      .filter((name) => name.endsWith(".css"))
      .map((name) => ({ file: `${pkg}/src/${name}`, css: readFileSync(join(dir, name), "utf8") }));
  });
}

const BASE = readFileSync(join(PACKAGES, "react/src/base.css"), "utf8");
const DEFINED = new Set([...BASE.matchAll(/(--el-space-[\w-]+):/g)].map(([, name = ""]) => name));

describe("literalSpacing", () => {
  it("finds literal lengths in spacing properties, comments aside", () => {
    const css = `/* padding: 3px; */
      .a { margin: 0 0 1rem; padding-inline: 12px; gap: 0.5em 2%; inset-block-end: -4px; }`;

    expect(literalSpacing(css)).toEqual([
      "margin: 0 0 1rem",
      "padding-inline: 12px",
      "gap: 0.5em 2%",
      "inset-block-end: -4px",
    ]);
  });

  it("accepts steps of the scale, zero, auto and lengths outside spacing", () => {
    const css = `.a { margin: 0 auto; padding: var(--el-space-2) var(--el-space-4);
      gap: calc(var(--el-space-4) / -2); min-height: 2.75rem; border: 1px solid; inset: 0; }`;

    expect(literalSpacing(css)).toEqual([]);
  });
});

describe("the module's stylesheets", () => {
  it("found every stylesheet of the react and admin packages", () => {
    expect(stylesheets().map(({ file }) => file)).toEqual(
      expect.arrayContaining(["react/src/base.css", "react/src/kit.css", "admin/src/admin.css"]),
    );
  });

  it.each(stylesheets())("$file spaces with the scale only", ({ css }) => {
    expect(literalSpacing(css)).toEqual([]);
  });

  it.each(stylesheets())("$file uses only steps the scale defines", ({ css }) => {
    expect(usedSteps(css).filter((name) => !DEFINED.has(name))).toEqual([]);
  });

  it("derives every step from the spacing unit", () => {
    expect([...DEFINED].sort()).toEqual([
      "--el-space-1",
      "--el-space-2",
      "--el-space-3",
      "--el-space-4",
      "--el-space-5",
      "--el-space-6",
      "--el-space-8",
      "--el-space-unit",
    ]);
    expect(BASE).toContain("--el-space-unit: 0.25rem;");
    expect(BASE).toContain("--el-space-1: var(--el-space-unit);");
    expect(BASE).toContain("--el-space-8: calc(var(--el-space-unit) * 8);");
  });
});

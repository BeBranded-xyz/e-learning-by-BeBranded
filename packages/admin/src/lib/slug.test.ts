import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { slugSchema } from "@bebranded/elearning-core";

import { slugify } from "./slug.js";

describe("slugify", () => {
  it.each([
    ["Safety basics", "safety-basics"],
    ["Sécurité : les bases", "securite-les-bases"],
    ["  --Fire   drill 2026!--  ", "fire-drill-2026"],
    ["Ünïcödé", "unicode"],
    ["", ""],
    ["!!!", ""],
  ])("turns %j into %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("keeps at most 100 characters without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(99)} b`);

    expect(slug).toBe("a".repeat(99));
  });

  it("always produces a valid slug, or nothing", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (title) => {
        const slug = slugify(title);
        expect(slug === "" || slugSchema.safeParse(slug).success).toBe(true);
      }),
    );
  });
});

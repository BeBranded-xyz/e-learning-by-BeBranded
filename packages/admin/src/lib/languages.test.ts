import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { localeSchema } from "@bebranded/elearning-core";
import { languageOptions } from "./languages.js";

describe("course language catalog", () => {
  it("includes languages beyond the product UI's translations", () => {
    const options = languageOptions("en", "en");
    expect(options.length).toBeGreaterThan(180);
    expect(options).toContainEqual({ value: "es", label: "Spanish (es)" });
    expect(options).toContainEqual({ value: "ar", label: "Arabic (ar)" });
    expect(options).toContainEqual({ value: "zh", label: "Chinese (zh)" });
    expect(options.every((option) => localeSchema.safeParse(option.value).success)).toBe(true);
  });
  it("localizes labels and preserves a regional value without duplicates", () => {
    const options = languageOptions("fr", "fr-FR");
    expect(options).toContainEqual({ value: "de", label: "allemand (de)" });
    expect(options.filter((option) => option.value === "fr-FR")).toHaveLength(1);
  });
  it("preserves any already-stored regional tag accepted by the course contract", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("en", "fr", "es", "de", "zh", "ar"),
        fc.constantFrom("US", "FR", "GB", "CA", "MX"),
        (language, region) => {
          const tag = `${language}-${region}`;
          expect(languageOptions("en", tag).some((option) => option.value === tag)).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });
});

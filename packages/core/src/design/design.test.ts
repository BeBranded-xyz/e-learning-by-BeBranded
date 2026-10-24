import { describe, expect, it } from "vitest";

import { DARK, LIGHT } from "../../tests/fixtures/designs.js";
import { colorsSchema, defineDesign } from "./design.js";
import { COLOR_TOKENS } from "./design.types.js";

describe("defineDesign", () => {
  it("resolves a light-only design with defaults", () => {
    const design = defineDesign({ colors: { light: LIGHT } });

    expect(design.darkMode).toBe("off");
    expect(design.colors.dark).toEqual(LIGHT);
    expect(design.radius).toBe("0.5rem");
    expect(design.fonts.heading).toBe(design.fonts.body);
    expect(design.fonts.mono).toBe("ui-monospace, monospace");
    expect(design.brand).toEqual({ name: "", logo: null });
  });

  it("fills dark colors from the light ones, token by token", () => {
    const design = defineDesign({ colors: { light: LIGHT, dark: DARK } });

    expect(design.darkMode).toBe("media");
    expect(design.colors.dark.background).toBe(DARK.background);
    expect(design.colors.dark.destructive).toBe(LIGHT.destructive);
  });

  it("keeps the declared dark mode, fonts, radius and brand", () => {
    const logo = "data:image/png;base64,iVBORw0KGgo=";
    const design = defineDesign({
      colors: { light: LIGHT, dark: DARK },
      darkMode: "class",
      radius: "0.625rem",
      fonts: { body: "Inter, sans-serif", heading: '"Cal Sans", sans-serif' },
      brand: { name: "Acme Corp training", logo },
    });

    expect(design).toMatchObject({
      darkMode: "class",
      radius: "0.625rem",
      fonts: { body: "Inter, sans-serif", heading: '"Cal Sans", sans-serif' },
      brand: { name: "Acme Corp training", logo },
    });
  });

  it("names every invalid token", () => {
    expect(() =>
      defineDesign({
        colors: { light: { ...LIGHT, primary: "red; x: y", ring: "blue" }, dark: { card: "nope" } },
        radius: "1rem; color: red",
        fonts: { body: "Inter; } body {" },
      }),
    ).toThrow(
      /colors\.light\.primary must be a color.*colors\.light\.ring must be a color.*colors\.dark\.card must be a color.*radius must be a length.*fonts\.body must be a list of font names/,
    );
  });

  it.each([
    ["a missing light token", { colors: { light: { ...LIGHT, ring: undefined } } }],
    ["an unknown token", { colors: { light: { ...LIGHT, brand: "#fff" } } }],
    ["an unknown option", { colors: { light: LIGHT }, shadows: "lg" }],
    [
      "an SVG logo",
      { colors: { light: LIGHT }, brand: { logo: "data:image/svg+xml;base64,PHN2Zz4=" } },
    ],
    [
      "a remote logo",
      { colors: { light: LIGHT }, brand: { logo: "https://example.com/logo.png" } },
    ],
    ["an unknown dark mode", { colors: { light: LIGHT }, darkMode: "auto" }],
  ])("refuses %s", (_label, input) => {
    // The inputs are deliberately outside DesignInput: what a JavaScript caller could pass.
    expect(() => defineDesign(input as never)).toThrow(/^Invalid design:/);
  });

  it("lists exactly the color tokens in its schema", () => {
    expect(Object.keys(colorsSchema.shape)).toEqual([...COLOR_TOKENS]);
  });
});

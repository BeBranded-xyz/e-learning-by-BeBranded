import { describe, expect, it } from "vitest";

import { themeToStyle } from "./theme.js";

describe("themeToStyle", () => {
  it("maps the host theme to --el-* variables", () => {
    expect(
      themeToStyle({
        colors: {
          primary: "#5B3DF5",
          primaryForeground: "white",
          surface: "rgb(247, 247, 249)",
          text: "oklch(0.2 0.01 260)",
        },
        radius: "8px",
        fontFamily: "Inter, sans-serif",
      }),
    ).toEqual({
      "--el-color-primary": "#5B3DF5",
      "--el-color-primary-foreground": "white",
      "--el-color-surface": "rgb(247, 247, 249)",
      "--el-color-text": "oklch(0.2 0.01 260)",
      "--el-radius": "8px",
      "--el-font-family": "Inter, sans-serif",
    });
  });

  it("returns nothing without a theme", () => {
    expect(themeToStyle(undefined)).toEqual({});
  });

  it.each([
    [
      "a color with an extra declaration",
      { colors: { primary: "red; background: url(https://evil.example.net)" } },
    ],
    ["a color with a url", { colors: { danger: "url(x)" } }],
    ["a radius with an expression", { radius: "calc(1px + 1px); color: red" }],
    ["a font with a semicolon", { fontFamily: "Inter; background: red" }],
    ["a font with braces", { fontFamily: "x} body { display: none" }],
  ])("drops %s", (_label, theme) => {
    expect(themeToStyle(theme)).toEqual({});
  });
});

import { describe, expect, it } from "vitest";

import { exportCss } from "./export-css.js";

describe("exportCss", () => {
  it("writes the theme's colors and fonts into the print CSS", () => {
    const css = exportCss(
      {
        primaryColor: "#112233",
        textColor: "#0a0a0a",
        mutedColor: "#595959",
        borderColor: "#e5e5e5",
        surfaceColor: "#f5f5f5",
        successColor: "#15803d",
        warningColor: "#a16207",
        destructiveColor: "#b91c1c",
        fontFamily: "Inter, sans-serif",
        headingFontFamily: '"Cal Sans", Georgia, serif',
      },
      "A4",
    );

    expect(css).toContain(
      "--el-primary: #112233; --el-text: #0a0a0a; --el-muted: #595959; --el-border: #e5e5e5;",
    );
    expect(css).toContain("font-family: Inter, sans-serif;");
    expect(css).toContain('font-family: "Cal Sans", Georgia, serif;');
    expect(css).toContain('.el-callout[data-variant="warning"] { border-color: #a16207; }');
    expect(css).toContain("pre { white-space: pre-wrap; background: #f5f5f5;");
  });

  it.each([
    ["a color with CSS after it", { textColor: "#000000; } body { display: none" }],
    ["a named color", { mutedColor: "red" }],
    ["a short hex", { borderColor: "#fff" }],
    ["a font closing the rule", { fontFamily: "Inter; } * { color: red" }],
  ])("falls back to the defaults for %s", (_label, theme) => {
    const css = exportCss(theme, "Letter");

    expect(css).not.toContain("display: none");
    expect(css).not.toContain("color: red");
    expect(css).toContain("--el-text: #111827;");
    expect(css).toContain("size: Letter");
  });

  it("uses the body font for headings when none is given", () => {
    expect(exportCss({ fontFamily: "Inter" }, "A4")).toMatch(
      /h1, h2, h3, h4, h5, h6 \{[^}]*font-family: Inter; \}/,
    );
  });
});

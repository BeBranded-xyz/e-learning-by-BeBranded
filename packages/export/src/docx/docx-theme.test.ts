import { describe, expect, it } from "vitest";

import { docxStyles, resolveDocxTheme } from "./docx-theme.js";

describe("resolveDocxTheme", () => {
  it("gives Word six hex digits and one font name each", () => {
    expect(
      resolveDocxTheme({
        primaryColor: "#4338ca",
        textColor: "#0a0a0a",
        mutedColor: "#595959",
        fontFamily: '"Inter Tight", Inter, sans-serif',
        headingFontFamily: "Georgia, serif",
      }),
    ).toEqual({
      primary: "4338CA",
      text: "0A0A0A",
      muted: "595959",
      font: "Inter Tight",
      headingFont: "Georgia",
    });
  });

  it("uses Word's defaults for generic families, invalid values and nothing", () => {
    expect(resolveDocxTheme({ fontFamily: "system-ui, sans-serif", primaryColor: "red" })).toEqual({
      primary: "1D4ED8",
      text: "111827",
      muted: "4B5563",
      font: "Calibri",
      headingFont: "Calibri",
    });
    expect(resolveDocxTheme({ fontFamily: "Inter; } x {" }).font).toBe("Calibri");
    expect(resolveDocxTheme().headingFont).toBe("Calibri");
  });
});

describe("docxStyles", () => {
  it("sets the document font and color and every heading's", () => {
    const styles = docxStyles(
      resolveDocxTheme({ fontFamily: "Inter", headingFontFamily: "Georgia", textColor: "#222222" }),
    );

    expect(styles.default.document.run).toMatchObject({ font: "Inter", color: "222222" });
    expect(styles.default.heading4.run).toMatchObject({
      font: "Georgia",
      color: "222222",
      bold: true,
    });
    expect(styles.paragraphStyles.map((style) => style.id)).toEqual(["Quote", "Code"]);
  });
});

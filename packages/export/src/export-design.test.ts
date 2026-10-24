import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { defineDesign } from "@bebranded/elearning-core/design";
import type { DesignColors } from "@bebranded/elearning-core/design";

import { courseExport } from "../tests/fixtures/documents.js";
import { elearningExport } from "./elearning-export.js";
import type { PdfRenderer } from "./pdf/pdf-renderer.js";

const LIGHT: DesignColors = {
  background: "#ffffff",
  foreground: "#1a1a2e",
  card: "#ffffff",
  cardForeground: "#1a1a2e",
  primary: "oklch(62.8% 0.2577 29.23)",
  primaryForeground: "#ffffff",
  secondary: "#f5f5f5",
  secondaryForeground: "#1a1a2e",
  muted: "#f0f0f5",
  mutedForeground: "#55556a",
  accent: "#f5f5f5",
  accentForeground: "#1a1a2e",
  destructive: "#b91c1c",
  destructiveForeground: "#ffffff",
  success: "#15803d",
  successForeground: "#ffffff",
  warning: "#a16207",
  warningForeground: "#ffffff",
  border: "#dddde5",
  input: "#dddde5",
  ring: "#a3a3a3",
};
const LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const design = defineDesign({
  colors: { light: LIGHT },
  fonts: { body: "Inter, sans-serif", heading: "Georgia, serif" },
  brand: { name: "Acme Corp training", logo: LOGO },
});

const noImages = () => Promise.resolve(null);

describe("exports read the design file", () => {
  it("PDF: the print CSS takes the design's colors and fonts, the cover its logo", async () => {
    let html = "";
    const pdf: PdfRenderer = {
      name: "recording",
      render: (request) => {
        html = request.html;
        return Promise.resolve(new Uint8Array([37, 80, 68, 70]));
      },
    };

    await elearningExport({ pdf, design }).export(courseExport(), {
      format: "pdf",
      loadImage: noImages,
    });

    expect(html).toContain(
      "--el-primary: #ff0000; --el-text: #1a1a2e; --el-muted: #55556a; --el-border: #dddde5;",
    );
    expect(html).toContain("font-family: Inter, sans-serif;");
    expect(html).toContain("font-family: Georgia, serif;");
    expect(html).toContain(`src="${LOGO}"`);
  });

  it("Word: fonts, text color and link color from the design", async () => {
    const file = await elearningExport({ design }).export(courseExport(), {
      format: "docx",
      loadImage: noImages,
    });
    const zip = await JSZip.loadAsync(file.bytes);
    const styles = (await zip.file("word/styles.xml")?.async("string")) ?? "";
    const document = (await zip.file("word/document.xml")?.async("string")) ?? "";

    expect(styles).toContain('w:ascii="Inter"');
    expect(styles).toContain('w:ascii="Georgia"');
    expect(styles).toContain('w:val="1A1A2E"');
    expect(document).toContain('w:color w:val="FF0000"');
  });

  it("keeps the module's look without a design", async () => {
    let html = "";
    const pdf: PdfRenderer = {
      name: "recording",
      render: (request) => {
        html = request.html;
        return Promise.resolve(new Uint8Array([37]));
      },
    };

    await elearningExport({ pdf }).export(courseExport(), { format: "pdf", loadImage: noImages });

    expect(html).toContain("--el-primary: #4338ca;");
    expect(html).not.toContain("<img");
  });
});

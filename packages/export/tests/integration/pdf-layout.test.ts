import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { elearningExport, playwrightPdf } from "../../src/index.js";
import { layoutCourse } from "../fixtures/layout.js";

// Layout checks of real PDFs (headless Chromium): sizes and positions read back with
// pdfjs. Portable across systems, unlike pixel snapshots, whose fonts differ by OS.

type Placed = { text: string; page: number; x: number; y: number; width: number; size: number };
type Laid = { items: Placed[]; pageWidth: number; pages: number };

async function layout(bytes: Uint8Array): Promise<Laid> {
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const items: Placed[] = [];
  let pageWidth = 0;
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    pageWidth = page.view[2] ?? 0;
    for (const item of (await page.getTextContent()).items) {
      if (!("str" in item) || item.str.trim() === "") continue;
      const [a = 0, b = 0, , , x = 0, y = 0] = item.transform as number[];
      items.push({ text: item.str, page: number, x, y, width: item.width, size: Math.hypot(a, b) });
    }
  }
  return { items, pageWidth, pages: pdf.numPages };
}

const renderer = playwrightPdf({ launch: () => chromium.launch() });
let laid: Laid;

beforeAll(async () => {
  const document = layoutCourse();
  const file = await elearningExport({ pdf: renderer }).export(document, {
    format: "pdf",
    loadImage: () => Promise.resolve(null),
  });
  laid = await layout(file.bytes);
}, 60_000);

afterAll(async () => {
  await renderer.close?.();
});

const find = (value: string): Placed => {
  const found = laid.items.find((item) => item.text === value);
  if (found === undefined) throw new Error(`"${value}" is not in the PDF`);
  return found;
};

describe("PDF layout of a course", () => {
  it("prints lesson headings larger than body text, in order of level", () => {
    const body = find("Body text line").size;

    expect(find("Heading three").size).toBeGreaterThan(body);
    expect(find("Heading two").size).toBeGreaterThan(find("Heading three").size);
  });

  it("lays columns side by side, the first taking its share of the row", () => {
    const left = find("Left column");
    const right = find("Right column");
    const margin = Math.min(...laid.items.map((item) => item.x));
    const contentWidth = laid.pageWidth - 2 * margin;

    expect(right.page).toBe(left.page);
    expect(Math.abs(right.y - left.y)).toBeLessThan(2);
    expect((right.x - left.x) / contentWidth).toBeCloseTo(0.6, 1);
  });

  it("keeps every line inside the page", () => {
    const outside = laid.items.filter(
      (item) => item.x < 0 || item.x + item.width > laid.pageWidth + 0.5,
    );

    expect(outside.map((item) => item.text)).toEqual([]);
  });

  it("numbers every page in the footer", () => {
    const numbers = laid.items.filter((item) => / \d+ \/ \d+$|^\d+ \/ \d+$/.test(item.text));

    expect(new Set(numbers.map((item) => item.page)).size).toBe(laid.pages);
  });
});

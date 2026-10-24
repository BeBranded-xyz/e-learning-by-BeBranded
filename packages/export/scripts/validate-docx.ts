// Usage: pnpm --filter @bebranded/elearning-export validate:docx   (needs LibreOffice: soffice)
// Renders the synthetic export documents to .docx, converts each one with headless
// LibreOffice, and checks the converted text: a file Word-compatible software cannot
// open, or that loses its content, fails the run. CI runs it (spec 10, "Testing").
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { ExportDocument } from "@bebranded/elearning-core";

import { imageInfo } from "../src/assets/image-info.js";
import { renderDocx } from "../src/docx/render-docx.js";
import { IMAGE_ID, courseExport, lessonExport } from "../tests/fixtures/documents.js";
import { PNG_1X1 } from "../tests/fixtures/images.js";
import { layoutCourse } from "../tests/fixtures/layout.js";

const CASES: { name: string; document: ExportDocument; expected: string[] }[] = [
  {
    name: "lesson",
    document: lessonExport(),
    expected: ["Fire safety", "Exit route", "Raise the alarm"],
  },
  {
    name: "course",
    document: courseExport(),
    expected: ["Workplace safety", "Basics", "Evacuation video"],
  },
  {
    name: "columns",
    document: layoutCourse(),
    expected: ["Heading two", "Left column", "Right column"],
  },
];

async function pdfText(file: string): Promise<string> {
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: false })
    .promise;
  const pages: string[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const content = await (await pdf.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join(" ").replace(/\s+/g, " ");
}

async function main(): Promise<void> {
  const info = imageInfo(PNG_1X1);
  if (info === null) throw new Error("the fixture picture is not a PNG");
  const images = new Map([[IMAGE_ID, { ...info, bytes: PNG_1X1, dataUri: "data:" }]]);
  const dir = mkdtempSync(path.join(os.tmpdir(), "validate-docx-"));
  const failures: string[] = [];
  try {
    for (const { name, document, expected } of CASES) {
      const docx = path.join(dir, `${name}.docx`);
      writeFileSync(docx, await renderDocx(document, { images, pageSize: "A4" }));
      // Fixed arguments; the file name is ours. A file LibreOffice cannot read produces no PDF.
      execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", dir, docx], {
        stdio: "inherit",
      });
      const text = await pdfText(path.join(dir, `${name}.pdf`)).catch(() => "");
      const missing = expected.filter((value) => !text.includes(value));
      if (missing.length > 0) failures.push(`${name}.docx: missing ${missing.join(", ")}`);
      else process.stdout.write(`${name}.docx opens in LibreOffice with its content\n`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
}

await main();

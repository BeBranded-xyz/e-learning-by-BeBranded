import { fileIdSchema } from "@bebranded/elearning-core";
import type { DocumentExporter, ExportDocument } from "@bebranded/elearning-core";

export const EXPORT_IMAGE = fileIdSchema.parse("6f1c2a4e-1b7d-4c3a-9f2e-0a1b2c3d4e5f");

/** Records what the server asks to render, and the images it can read. */
export function recordingExporter(formats: DocumentExporter["formats"] = ["pdf", "docx"]) {
  const documents: ExportDocument[] = [];
  const images: (Uint8Array | null)[] = [];
  let hold: Promise<void> = Promise.resolve();
  let started: () => void = () => undefined;
  const firstStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const exporter: DocumentExporter = {
    formats,
    export: async (document, request) => {
      documents.push(document);
      images.push(await request.loadImage(EXPORT_IMAGE));
      started();
      await hold;
      return {
        bytes: new TextEncoder().encode("FILE"),
        contentType: "application/pdf",
        extension: request.format,
      };
    },
  };
  return {
    exporter,
    documents,
    images,
    firstStarted,
    holdUntil: (gate: Promise<void>) => {
      hold = gate;
    },
  };
}

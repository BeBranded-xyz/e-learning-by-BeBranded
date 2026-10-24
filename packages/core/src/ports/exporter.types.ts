import type { FileId } from "../content/ids.js";
import type { ExportDocument } from "../export/export-document.types.js";

export type ExportFormat = "pdf" | "docx";

export type ExportedFile = {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly extension: ExportFormat;
};

/**
 * Renders an export tree to a file (spec 10). Implemented by
 * `elearningExport()` in @bebranded/elearning-export; the server only knows
 * this port, so hosts without export never install it.
 */
export type DocumentExporter = {
  readonly formats: readonly ExportFormat[];
  export(
    document: ExportDocument,
    request: {
      readonly format: ExportFormat;
      /** Reads an uploaded image through the host's FileStorage; null when it is gone. */
      readonly loadImage: (fileId: FileId, signal?: AbortSignal) => Promise<Uint8Array | null>;
      readonly signal?: AbortSignal | undefined;
    },
  ): Promise<ExportedFile>;
};

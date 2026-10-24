import { AppError, EXPORT_LIMITS, countExportBlocks } from "@bebranded/elearning-core";
import type {
  DocumentExporter,
  ExportDocument,
  ExportFormat,
  ExportedFile,
} from "@bebranded/elearning-core";
import { renderExportHtml } from "@bebranded/elearning-editor/server";
import type { ExportTheme } from "@bebranded/elearning-editor/server";

import { inlineImages } from "./assets/inline-images.js";
import type { ImageLoader } from "./assets/inline-images.js";
import { renderDocx } from "./docx/render-docx.js";
import { formatExportDate, labelsFor } from "./labels.js";
import { Limiter } from "./limiter.js";
import type { PdfRenderer } from "./pdf/pdf-renderer.js";

export type ElearningExportOptions = {
  /** Without it, only Word export is available. */
  readonly pdf?: PdfRenderer | undefined;
  /** "auto" picks Letter for US and Canadian English, A4 otherwise. */
  readonly pageSize?: "A4" | "Letter" | "auto";
  readonly theme?: ExportTheme | undefined;
  /** A PNG, JPEG, GIF or WebP data URI for course covers. */
  readonly logo?: string | undefined;
  /** Rendering deadline of one export (spec 10: 30 s by default). */
  readonly timeoutMs?: number;
  /** Renders running at once; more wait in a short queue, then are refused. */
  readonly maxConcurrent?: number;
  readonly maxQueued?: number;
};

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function pageSizeFor(locale: string, choice: ElearningExportOptions["pageSize"]): "A4" | "Letter" {
  if (choice === "A4" || choice === "Letter") return choice;
  return locale === "en-US" || locale === "en-CA" ? "Letter" : "A4";
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AppError("upstream", "export_timeout", "The export took too long to render."));
    }, timeoutMs);
  });
  return Promise.race([work, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

type Settings = ElearningExportOptions & { readonly timeoutMs: number };
type Request = { readonly format: ExportFormat; readonly loadImage: ImageLoader };

async function renderPdf(
  settings: Settings,
  pdf: PdfRenderer,
  document: ExportDocument,
  images: Awaited<ReturnType<typeof inlineImages>>,
) {
  const labels = labelsFor(document.locale);
  const exportedOn = labels.exportedOn(formatExportDate(document.exportedAt, document.locale));
  const pageSize = pageSizeFor(document.locale, settings.pageSize);
  const html = renderExportHtml(document, {
    imageSrc: (id) => images.get(id)?.dataUri,
    pageSize,
    theme: settings.theme,
    logo: settings.logo,
    labels: {
      tableOfContents: labels.tableOfContents,
      video: labels.video,
      attachment: labels.attachment,
      exportedOn,
    },
  });
  return pdf.render({
    html,
    pageSize,
    title: document.title,
    footer: exportedOn,
    timeoutMs: settings.timeoutMs,
  });
}

async function render(
  settings: Settings,
  document: ExportDocument,
  request: Request,
): Promise<ExportedFile> {
  const images = await inlineImages(document, request.loadImage);
  if (request.format === "docx") {
    const bytes = await renderDocx(document, {
      images,
      pageSize: pageSizeFor(document.locale, settings.pageSize),
    });
    return { bytes, extension: "docx", contentType: DOCX_TYPE };
  }
  if (settings.pdf === undefined) {
    throw new AppError("validation", "export_format_unavailable", "PDF export is not configured.");
  }
  return {
    bytes: await renderPdf(settings, settings.pdf, document, images),
    extension: "pdf",
    contentType: "application/pdf",
  };
}

/**
 * The module's PDF and Word export (spec 10). Pass it to createElearning as
 * `exporter`. Images are read through the host's FileStorage before
 * rendering; the PDF browser runs no script and loads nothing.
 */
export function elearningExport(options: ElearningExportOptions = {}): DocumentExporter {
  const settings: Settings = { ...options, timeoutMs: options.timeoutMs ?? 30_000 };
  const limiter = new Limiter(options.maxConcurrent ?? 2, options.maxQueued ?? 8);
  const formats: ExportFormat[] = options.pdf === undefined ? ["docx"] : ["pdf", "docx"];
  return {
    formats,
    export: (document, request) => {
      if (!formats.includes(request.format)) {
        return Promise.reject(
          new AppError(
            "validation",
            "export_format_unavailable",
            "This export format is not configured.",
          ),
        );
      }
      if (countExportBlocks(document) > EXPORT_LIMITS.maxBlocks) {
        return Promise.reject(
          new AppError("validation", "export_too_large", "This content is too large to export."),
        );
      }
      return limiter.run(() =>
        withTimeout(render(settings, document, request), settings.timeoutMs),
      );
    },
  };
}

import { AppError, validateLessonDocument } from "@bebranded/elearning-core";
import type {
  Course,
  DocumentExporter,
  ExportDocument,
  ExportFormat,
  ExportLesson,
  FileId,
  LessonDetail,
} from "@bebranded/elearning-core";

import type { ResolvedOptions } from "../config.js";
import type { RequestContext } from "../context.js";

const FORMATS: readonly ExportFormat[] = ["pdf", "docx"];

/** `?format=pdf|docx`; anything else is a client error (spec 10, "What can be exported"). */
export function exportFormatOf(context: RequestContext): ExportFormat {
  const raw = new URL(context.request.url).searchParams.get("format");
  const format = FORMATS.find((candidate) => candidate === raw);
  if (format !== undefined) return format;
  throw new AppError("validation", "validation_failed", "Ask for format=pdf or format=docx.", {
    details: { fields: [{ field: "format", code: "invalid_value", message: "pdf or docx" }] },
  });
}

export function requireExporter(context: RequestContext, format: ExportFormat): DocumentExporter {
  const exporter = context.options.exporter;
  if (exporter === null) {
    throw new AppError(
      "conflict",
      "export_not_configured",
      "Export is not configured on this site.",
    );
  }
  if (!exporter.formats.includes(format)) {
    throw new AppError(
      "validation",
      "export_format_unavailable",
      "This export format is not configured.",
    );
  }
  return exporter;
}

/** Admins export drafts and any course; learners only courses that allow it (spec 10). */
export function assertMayExport(context: RequestContext, course: Course): void {
  if (context.learner.isAdmin || course.allowLearnerExport) return;
  throw new AppError("forbidden", "export_not_allowed", "Export is not available for this course.");
}

/** The formats a course page may offer to this requester; none without an exporter. */
export function exportFormatsFor(context: RequestContext, course: Course): readonly ExportFormat[] {
  const exporter = context.options.exporter;
  if (exporter === null || (!context.learner.isAdmin && !course.allowLearnerExport)) return [];
  return exporter.formats;
}

export function toExportLesson(
  context: RequestContext,
  course: Course,
  lesson: LessonDetail,
): ExportLesson {
  const document = lesson.content === null ? null : validateLessonDocument(lesson.content);
  if (document?.ok === false) {
    context.logger.error("stored lesson content is invalid", {
      requestId: context.requestId,
      lessonId: lesson.id,
    });
  }
  const link = { courseId: course.id, courseSlug: course.slug, lessonId: lesson.id };
  const url = context.options.exportLessonUrl?.(link) ?? `${new URL(context.request.url).origin}/`;
  return {
    title: lesson.title,
    type: lesson.type,
    content: document?.ok === true ? document.value : null,
    url,
  };
}

/** Images come only through the host's FileStorage (spec 10); without `read`, exports have no pictures. */
function imageLoader(context: RequestContext) {
  const read = context.options.files?.read?.bind(context.options.files);
  return async (fileId: FileId): Promise<Uint8Array | null> => {
    if (read === undefined) return null;
    const [file] = await context.storage.findFiles(context.scope, [fileId]);
    if (file === undefined) return null;
    try {
      return await read(file.storageKey);
    } catch (error) {
      context.logger.warn("export image could not be read", {
        requestId: context.requestId,
        fileId,
        error,
      });
      return null;
    }
  };
}

const running = new WeakMap<ResolvedOptions, Map<string, number>>();

/** At most `exportsPerTenant` exports of one tenant at once; beyond, 429 `export_busy`. */
async function withTenantSlot<T>(context: RequestContext, work: () => Promise<T>): Promise<T> {
  const counts = running.get(context.options) ?? new Map<string, number>();
  running.set(context.options, counts);
  const tenant = context.scope.tenantId ?? "";
  const current = counts.get(tenant) ?? 0;
  if (current >= context.options.exportsPerTenant) {
    throw new AppError(
      "rate_limit",
      "export_busy",
      "Too many exports are running. Try again shortly.",
    );
  }
  counts.set(tenant, current + 1);
  try {
    return await work();
  } finally {
    counts.set(tenant, (counts.get(tenant) ?? 1) - 1);
  }
}

/** Renders and streams the file; exports are never stored (spec 10). */
export async function sendExport(
  context: RequestContext,
  input: {
    document: ExportDocument;
    format: ExportFormat;
    exporter: DocumentExporter;
    filename: string;
  },
): Promise<Response> {
  const loadImage = imageLoader(context);
  const file = await withTenantSlot(context, () =>
    input.exporter.export(input.document, {
      format: input.format,
      loadImage,
      signal: context.request.signal,
    }),
  );
  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${input.filename}.${file.extension}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": context.requestId,
    },
  });
}

import { z } from "zod";

import type {
  DocumentExporter,
  EventHandlers,
  FileStorage,
  IdentityResolver,
  StorageAdapter,
  VideoProvider,
} from "@bebranded/elearning-core";

export type Logger = {
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
};

const fn = <T>(name: string) =>
  z.custom<T>((value) => typeof value === "function", `${name} must be a function`);

/** Images and PDF by default (spec 04, section 4). */
const DEFAULT_FILE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

/** Types a browser may run as a page when the file URL is opened: never accepted. */
const ACTIVE_MIME_TYPES = new Set(["image/svg+xml", "text/html", "application/xhtml+xml"]);

const mimeTypeSchema = z
  .string()
  .regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/, "a lowercase type/subtype")
  .refine((value) => !ACTIVE_MIME_TYPES.has(value), "active content types are not allowed");

const fileUploadsSchema = z.strictObject({
  mimeTypes: z
    .array(mimeTypeSchema)
    .min(1)
    .max(50)
    .default([...DEFAULT_FILE_MIME_TYPES]),
  /** 10 MB by default, 1 GB at most. */
  maxBytes: z.int().min(1).max(1_073_741_824).default(10_485_760),
});

const optionsSchema = z.strictObject({
  storage: z.custom<StorageAdapter>(
    (value) => typeof value === "object" && value !== null && "transaction" in value,
    "storage must be a StorageAdapter, e.g. postgresStorage()",
  ),
  identity: fn<IdentityResolver>("identity"),
  /** Mount point of the route handler, e.g. "/api/elearning". */
  basePath: z
    .string()
    .regex(/^(\/[a-z0-9._~-]+)+$/i, "basePath must look like /api/elearning")
    .default("/api/elearning"),
  /** Content with a null tenant is visible to every tenant (spec 05). */
  sharedCatalog: z.boolean().default(false),
  /** Origins allowed to send state-changing requests; defaults to the request's own origin. */
  allowedOrigins: z
    .array(z.url({ protocol: /^https?$/ }).transform((url) => new URL(url).origin))
    .optional(),
  /** Video hosting for video lessons, e.g. cloudflareStream() (spec 06). */
  video: z
    .custom<VideoProvider>(
      (value) => typeof value === "object" && value !== null && "createPlaybackToken" in value,
      "video must be a VideoProvider, e.g. cloudflareStream()",
    )
    .optional(),
  /** The host's storage for editor images and attachments (spec 04, section 4). */
  files: z
    .custom<FileStorage>(
      (value) => typeof value === "object" && value !== null && "createUpload" in value,
      "files must be a FileStorage",
    )
    .optional(),
  fileUploads: fileUploadsSchema.prefault({}),
  /** PDF and Word export, e.g. elearningExport() from @bebranded/elearning-export (spec 10). */
  exporter: z
    .custom<DocumentExporter>(
      (value) =>
        typeof value === "object" && value !== null && "export" in value && "formats" in value,
      "exporter must be a DocumentExporter, e.g. elearningExport()",
    )
    .optional(),
  /** The host's page of a lesson, linked from exported videos and attachments; the site root by default. */
  exportLessonUrl: fn<(lesson: ExportLessonLink) => string>("exportLessonUrl").optional(),
  /** Exports one tenant may run at once (spec 10, "Export security"). */
  exportsPerTenant: z.int().min(1).max(20).default(2),
  events: z.record(z.string(), fn<(event: never) => Promise<void>>("event handler")).default({}),
  logger: z.custom<Logger>((value) => typeof value === "object" && value !== null).optional(),
  clock: fn<() => Date>("clock").optional(),
  generateId: fn<() => string>("generateId").optional(),
});

export type ExportLessonLink = {
  readonly courseId: string;
  readonly courseSlug: string;
  readonly lessonId: string;
};

export type ElearningOptions = z.input<typeof optionsSchema> & { events?: EventHandlers };

export type ResolvedOptions = {
  readonly storage: StorageAdapter;
  readonly identity: IdentityResolver;
  readonly basePath: string;
  readonly sharedCatalog: boolean;
  readonly allowedOrigins: readonly string[] | undefined;
  readonly video: VideoProvider | null;
  readonly files: FileStorage | null;
  readonly fileUploads: { readonly mimeTypes: readonly string[]; readonly maxBytes: number };
  readonly exporter: DocumentExporter | null;
  readonly exportLessonUrl: ((lesson: ExportLessonLink) => string) | null;
  readonly exportsPerTenant: number;
  readonly events: EventHandlers;
  readonly logger: Logger;
  readonly clock: () => Date;
  readonly generateId: () => string;
};

/* eslint-disable no-console -- the default logger, replaced by the host's (spec 08, "Observability") */
const consoleLogger: Logger = {
  warn: (message, meta) => {
    console.warn(message, meta ?? {});
  },
  error: (message, meta) => {
    console.error(message, meta ?? {});
  },
};
/* eslint-enable no-console */

/** Validates the host's configuration once, at startup (core/code-standards.mdc, "Configuration"). */
export function resolveOptions(input: ElearningOptions): ResolvedOptions {
  const options = optionsSchema.parse(input);
  return {
    storage: options.storage,
    identity: options.identity,
    basePath: options.basePath,
    sharedCatalog: options.sharedCatalog,
    allowedOrigins: options.allowedOrigins,
    video: options.video ?? null,
    files: options.files ?? null,
    fileUploads: options.fileUploads,
    exporter: options.exporter ?? null,
    exportLessonUrl: options.exportLessonUrl ?? null,
    exportsPerTenant: options.exportsPerTenant,
    events: input.events ?? {},
    logger: options.logger ?? consoleLogger,
    clock: options.clock ?? (() => new Date()),
    generateId: options.generateId ?? (() => crypto.randomUUID()),
  };
}

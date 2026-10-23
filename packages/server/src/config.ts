import { z } from "zod";

import type {
  EventHandlers,
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
  events: z.record(z.string(), fn<(event: never) => Promise<void>>("event handler")).default({}),
  logger: z.custom<Logger>((value) => typeof value === "object" && value !== null).optional(),
  clock: fn<() => Date>("clock").optional(),
  generateId: fn<() => string>("generateId").optional(),
});

export type ElearningOptions = z.input<typeof optionsSchema> & { events?: EventHandlers };

export type ResolvedOptions = {
  readonly storage: StorageAdapter;
  readonly identity: IdentityResolver;
  readonly basePath: string;
  readonly sharedCatalog: boolean;
  readonly allowedOrigins: readonly string[] | undefined;
  readonly video: VideoProvider | null;
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
    events: input.events ?? {},
    logger: options.logger ?? consoleLogger,
    clock: options.clock ?? (() => new Date()),
    generateId: options.generateId ?? (() => crypto.randomUUID()),
  };
}

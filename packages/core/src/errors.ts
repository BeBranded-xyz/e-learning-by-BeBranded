/**
 * Error model shared by every package (core/error-handling.mdc).
 * Each error belongs to one class (`kind`) and carries a stable snake_case
 * `code`. Codes are part of the public API: never rename one without a
 * deprecation.
 */
export const ErrorKind = {
  validation: "validation",
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  notFound: "not_found",
  conflict: "conflict",
  rateLimit: "rate_limit",
  upstream: "upstream",
  internal: "internal",
} as const;

export type ErrorKind = (typeof ErrorKind)[keyof typeof ErrorKind];

export type ErrorDetails = Readonly<Record<string, unknown>>;

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly code: string;
  readonly details: ErrorDetails | undefined;

  constructor(
    kind: ErrorKind,
    code: string,
    message: string,
    options?: { details?: ErrorDetails; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.kind = kind;
    this.code = code;
    this.details = options?.details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

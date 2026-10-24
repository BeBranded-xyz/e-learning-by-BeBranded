import { AppError } from "@bebranded/elearning-core";
import type { ErrorKind } from "@bebranded/elearning-core";

/** HTTP status per error class (core/error-handling.mdc, modules/integrations.mdc). */
export const STATUS_BY_KIND: Record<ErrorKind, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limit: 429,
  upstream: 502,
  internal: 500,
};

/** Errors that only the HTTP layer raises (they have no domain meaning). */
export const httpErrors = {
  notFound: () =>
    new AppError(
      "not_found",
      "not_found",
      "The resource does not exist or is not available to you.",
    ),
  methodNotAllowed: () =>
    new AppError("validation", "method_not_allowed", "This method is not allowed on this route."),
  unsupportedMediaType: () =>
    new AppError(
      "validation",
      "unsupported_media_type",
      "Send the request body as application/json.",
    ),
  payloadTooLarge: () =>
    new AppError("validation", "payload_too_large", "The request body is too large."),
  invalidJson: () =>
    new AppError("validation", "invalid_json", "The request body is not valid JSON."),
  originNotAllowed: () =>
    new AppError("forbidden", "origin_not_allowed", "Requests from this origin are not allowed."),
  unauthenticated: () => new AppError("unauthenticated", "unauthenticated", "Sign in to continue."),
  invalidSignature: () =>
    new AppError("unauthenticated", "invalid_signature", "The webhook signature is invalid."),
  forbidden: () => new AppError("forbidden", "forbidden", "You are not allowed to do this."),
};

export const STATUS_OVERRIDES: Record<string, number> = {
  method_not_allowed: 405,
  unsupported_media_type: 415,
  payload_too_large: 413,
  file_too_large: 413,
  file_type_not_allowed: 415,
};

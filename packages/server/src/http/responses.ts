import type { AppError } from "@bebranded/elearning-core";

import { STATUS_BY_KIND, STATUS_OVERRIDES } from "./http-error.js";

/** Learner data is personal: never cached by browsers or shared caches. */
function baseHeaders(requestId: string): Headers {
  return new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
  });
}

export function json(body: unknown, requestId: string, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders(requestId) });
}

export function noContent(requestId: string): Response {
  const headers = baseHeaders(requestId);
  headers.delete("content-type");
  return new Response(null, { status: 204, headers });
}

export function statusOf(error: AppError): number {
  return STATUS_OVERRIDES[error.code] ?? STATUS_BY_KIND[error.kind];
}

/** One error envelope everywhere (modules/api-design.mdc). Internal errors never expose their message. */
export function errorResponse(error: AppError, requestId: string): Response {
  const status = statusOf(error);
  const safe =
    status >= 500
      ? { code: "internal_error", message: "Something went wrong. Try again later." }
      : error;
  const details = status < 500 && error.details !== undefined ? { details: error.details } : {};
  const response = json(
    { error: { code: safe.code, message: safe.message, ...details, request_id: requestId } },
    requestId,
    status,
  );
  const retryAfter = error.details?.retry_after_seconds;
  if (status === 429 && typeof retryAfter === "number") {
    response.headers.set("retry-after", String(Math.max(1, Math.ceil(retryAfter))));
  }
  return response;
}

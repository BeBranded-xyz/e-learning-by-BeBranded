import { httpErrors } from "./http-error.js";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defense (spec 08): a browser sends `Origin` on state-changing
 * requests. When present, it must be an allowed origin (by default, the
 * request's own origin). Requests without `Origin` come from non-browser
 * clients, which cannot carry a victim's cookies.
 */
export function assertAllowedOrigin(
  request: Request,
  allowedOrigins: readonly string[] | undefined,
): void {
  if (!STATE_CHANGING.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin === null) return;
  const allowed = allowedOrigins ?? [new URL(request.url).origin];
  if (!allowed.includes(origin)) throw httpErrors.originNotAllowed();
}

/**
 * Reads a JSON body with a size limit, checked on the declared length first,
 * then on the bytes actually received.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(\s*;|$)/i.test(contentType)) throw httpErrors.unsupportedMediaType();
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw httpErrors.payloadTooLarge();
  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) throw httpErrors.payloadTooLarge();
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw httpErrors.invalidJson();
  }
}

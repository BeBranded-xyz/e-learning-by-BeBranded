import { httpErrors } from "./http-error.js";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The host the browser addressed. Frameworks may rewrite `request.url`
 * (`next start` reports localhost), so the Host header, or the first
 * X-Forwarded-Host behind a proxy, is what the Origin is compared with.
 */
function addressedHosts(request: Request): string[] {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = request.headers.get("host");
  return [forwarded, host, new URL(request.url).host].filter(
    (value): value is string => value !== undefined && value !== null && value !== "",
  );
}

function originHost(origin: string): string | null {
  return URL.canParse(origin) ? new URL(origin).host : null;
}

/**
 * CSRF defense (spec 08): a browser sends `Origin` on state-changing
 * requests. When present, it must be an allowed origin, by default the host
 * the browser addressed. Requests without `Origin` come from non-browser
 * clients, which cannot carry a victim's cookies.
 */
export function assertAllowedOrigin(
  request: Request,
  allowedOrigins: readonly string[] | undefined,
): void {
  if (!STATE_CHANGING.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin === null) return;
  const allowed =
    allowedOrigins === undefined
      ? addressedHosts(request).includes(originHost(origin) ?? "")
      : allowedOrigins.includes(origin);
  if (!allowed) throw httpErrors.originNotAllowed();
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

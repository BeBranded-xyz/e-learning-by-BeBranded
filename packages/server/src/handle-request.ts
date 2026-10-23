import { AppError, isAppError, learnerSchema } from "@bebranded/elearning-core";
import type { Learner } from "@bebranded/elearning-core";

import type { ResolvedOptions } from "./config.js";
import type { RequestContext } from "./context.js";
import { httpErrors } from "./http/http-error.js";
import { assertAllowedOrigin } from "./http/request.js";
import { errorResponse, statusOf } from "./http/responses.js";
import { matchRoute, relativePath } from "./http/router.js";
import type { Route } from "./http/router.js";
import { VIDEO_WEBHOOK_PATH, handleVideoWebhook } from "./webhooks/video-webhook.js";

const REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/** Reuses a well-formed incoming request id (for log correlation), else generates one. */
function requestIdOf(request: Request, options: ResolvedOptions): string {
  const incoming = request.headers.get("x-request-id");
  return incoming !== null && REQUEST_ID.test(incoming) ? incoming : `req_${options.generateId()}`;
}

/** Calls the host on every request: identity is never cached (spec 04). */
async function authenticate(request: Request, options: ResolvedOptions): Promise<Learner> {
  const raw = await options.identity(request);
  if (raw === null) throw httpErrors.unauthenticated();
  const parsed = learnerSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      "internal",
      "invalid_identity",
      "The identity resolver returned an invalid learner",
      {
        details: { issues: parsed.error.issues.map((issue) => issue.path.join(".")) },
      },
    );
  }
  return parsed.data;
}

function buildContext(
  request: Request,
  requestId: string,
  learner: Learner,
  options: ResolvedOptions,
): RequestContext {
  return {
    request,
    requestId,
    learner,
    scope: { tenantId: learner.tenantId, includeShared: options.sharedCatalog },
    storage: options.storage,
    logger: options.logger,
    options,
    now: options.clock,
    newId: options.generateId,
  };
}

function logFailure(error: unknown, requestId: string, options: ResolvedOptions): AppError {
  if (isAppError(error) && statusOf(error) < 500) {
    options.logger.warn("request rejected", { requestId, code: error.code });
    return error;
  }
  // Unexpected: log with the request id, answer with a generic message (spec 08, "Errors").
  options.logger.error("request failed", { requestId, error });
  return isAppError(error)
    ? error
    : new AppError("internal", "internal_error", "Unexpected error", { cause: error });
}

/** The single entry point: route, authenticate, authorize, run, and map errors to the envelope. */
export async function handleRequest(
  request: Request,
  options: ResolvedOptions,
  routes: readonly Route<RequestContext>[],
): Promise<Response> {
  const requestId = requestIdOf(request, options);
  try {
    const path = relativePath(request, options.basePath);
    if (path === null) throw httpErrors.notFound();
    // Server-to-server: no learner session and no browser Origin to check.
    if (path === VIDEO_WEBHOOK_PATH) return await handleVideoWebhook(request, options, requestId);
    const { route, params } = matchRoute(routes, request.method, path);
    assertAllowedOrigin(request, options.allowedOrigins);
    const learner = await authenticate(request, options);
    if (path.startsWith("/v1/admin/") && !learner.isAdmin) throw httpErrors.forbidden();
    return await route.handle(buildContext(request, requestId, learner, options), params);
  } catch (error) {
    return errorResponse(logFailure(error, requestId, options), requestId);
  }
}

import type { Elearning } from "@bebranded/elearning-server";

type Handler = (request: Request) => Promise<Response>;

export type ElearningRouteHandlers = {
  readonly GET: Handler;
  readonly POST: Handler;
  readonly PATCH: Handler;
  readonly PUT: Handler;
  readonly DELETE: Handler;
};

/**
 * Route handlers for `app/api/elearning/[...path]/route.ts` (spec 04):
 *
 * ```ts
 * export const { GET, POST, PATCH, PUT, DELETE } = createElearningRouteHandler(elearning);
 * ```
 *
 * Next.js passes a second `context` argument; the module routes on the URL
 * and ignores it. Mount the file at the `basePath` given to createElearning.
 */
export function createElearningRouteHandler(elearning: Elearning): ElearningRouteHandlers {
  const handle: Handler = (request) => elearning.handle(request);
  return { GET: handle, POST: handle, PATCH: handle, PUT: handle, DELETE: handle };
}

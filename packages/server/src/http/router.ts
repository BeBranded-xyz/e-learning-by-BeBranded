import { httpErrors } from "./http-error.js";

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type RouteParams = Readonly<Record<string, string>>;

export type Route<C> = {
  readonly method: Method;
  readonly pattern: string;
  readonly handle: (context: C, params: RouteParams) => Promise<Response>;
};

type Match<C> = { route: Route<C>; params: RouteParams };

/** A malformed escape (`%E0%A4%A`) is a path that matches nothing, not a server error. */
function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function matchPattern(pattern: string, path: string): RouteParams | null {
  const expected = pattern.split("/");
  const actual = path.split("/");
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index] ?? "";
    if (segment.startsWith(":")) {
      const decoded = safeDecode(value);
      if (decoded === null || decoded === "") return null;
      params[segment.slice(1)] = decoded;
    } else if (segment !== value) {
      return null;
    }
  }
  return params;
}

/** Finds the route for a path relative to the mount point; 404 or 405 otherwise. */
export function matchRoute<C>(routes: readonly Route<C>[], method: string, path: string): Match<C> {
  let pathMatched = false;
  for (const route of routes) {
    const params = matchPattern(route.pattern, path);
    if (params === null) continue;
    pathMatched = true;
    if (route.method === method) return { route, params };
  }
  throw pathMatched ? httpErrors.methodNotAllowed() : httpErrors.notFound();
}

/** Path of the request relative to the mount point, without trailing slash. */
export function relativePath(request: Request, basePath: string): string | null {
  const { pathname } = new URL(request.url);
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return null;
  const rest = pathname.slice(basePath.length);
  return rest.length > 1 && rest.endsWith("/") ? rest.slice(0, -1) : rest || "/";
}

import { describe, expect, it } from "vitest";

import { matchRoute, relativePath } from "./router.js";
import type { Route } from "./router.js";

const ok = () => Promise.resolve(new Response());
const routes: Route<null>[] = [
  { method: "GET", pattern: "/v1/courses", handle: ok },
  { method: "GET", pattern: "/v1/courses/:slug", handle: ok },
  { method: "POST", pattern: "/v1/courses/:id/enroll", handle: ok },
];

describe("matchRoute", () => {
  it("matches static and parameterized routes and decodes parameters", () => {
    expect(matchRoute(routes, "GET", "/v1/courses").params).toEqual({});
    expect(matchRoute(routes, "GET", "/v1/courses/s%C3%A9curit%C3%A9").params).toEqual({
      slug: "sécurité",
    });
    expect(matchRoute(routes, "POST", "/v1/courses/abc/enroll").route.pattern).toBe(
      "/v1/courses/:id/enroll",
    );
  });

  it.each([
    ["an unknown path", "GET", "/v2/courses", "not_found"],
    ["a longer path", "GET", "/v1/courses/a/b/c", "not_found"],
    ["an empty parameter", "GET", "/v1/courses/", "not_found"],
    ["a malformed escape", "GET", "/v1/courses/%E0%A4%A", "not_found"],
    ["a known path with another method", "DELETE", "/v1/courses", "method_not_allowed"],
  ])("rejects %s", (_label, method, path, code) => {
    expect(() => matchRoute(routes, method, path)).toThrow(expect.objectContaining({ code }));
  });
});

describe("relativePath", () => {
  const path = (url: string) => relativePath(new Request(url), "/api/elearning");

  it.each([
    ["https://h.example.com/api/elearning/v1/courses", "/v1/courses"],
    ["https://h.example.com/api/elearning/v1/courses/", "/v1/courses"],
    ["https://h.example.com/api/elearning", "/"],
    ["https://h.example.com/api/elearning/", "/"],
    ["https://h.example.com/api/elearning/v1/courses?x=1", "/v1/courses"],
  ])("maps %s to %s", (url, expected) => {
    expect(path(url)).toBe(expected);
  });

  it.each([
    "https://h.example.com/api/elearningx/v1",
    "https://h.example.com/other",
    "https://h.example.com/api",
  ])("rejects %s, outside the mount point", (url) => {
    expect(path(url)).toBeNull();
  });
});

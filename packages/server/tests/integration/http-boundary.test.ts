import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aCourse } from "../../../db/tests/support/factories.js";
import { ORIGIN, createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  const course = aCourse(tenant);
  await seed(t.database, [{ course, rules: [rule(course, "course", "allow")] }]);
});

afterAll(async () => {
  await t.database.drop();
});

describe("authentication", () => {
  it("answers 401 with the error envelope when the host resolves no learner", async () => {
    const response = await t.request("GET", "/v1/courses");
    const body = await readJson(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: "unauthenticated",
        message: "Sign in to continue.",
        request_id: response.headers.get("x-request-id"),
      },
    });
  });

  it("calls the identity resolver on every request (never cached)", async () => {
    const before = t.identityCalls.length;

    await t.request("GET", "/v1/courses", { as: "staff" });
    await t.request("GET", "/v1/courses", { as: "staff" });

    expect(t.identityCalls.length - before).toBe(2);
  });

  it("answers a generic 500 when the host returns an invalid learner, and logs the cause", async () => {
    const broken = await createTestApp({
      identity: () =>
        Promise.resolve({ learnerId: "", tenantId: null, roles: "admin", isAdmin: "yes" } as never),
    });
    const response = await broken.request("GET", "/v1/courses");
    const body = await readJson(response);

    expect(response.status).toBe(500);
    expect(body.error).toMatchObject({
      code: "internal_error",
      message: "Something went wrong. Try again later.",
    });
    expect(JSON.stringify(body)).not.toContain("learnerId");
    expect(broken.logs.some((log) => log.level === "error")).toBe(true);
    await broken.database.drop();
  });
});

describe("routing", () => {
  it.each([
    ["an unknown route", "GET", "/v1/unknown"],
    ["a malformed escape", "GET", "/v1/courses/%E0%A4%A"],
    ["the mount point itself", "GET", ""],
  ])("answers 404 for %s", async (_label, method, path) => {
    const response = await t.request(method, path, { as: "staff" });

    expect(response.status).toBe(404);
    expect((await readJson(response)).error).toMatchObject({ code: "not_found" });
  });

  it("answers 404 outside the mount point", async () => {
    const response = await t.app.handle(
      new Request(`${ORIGIN}/other/v1/courses`, { headers: { authorization: "Bearer staff" } }),
    );

    expect(response.status).toBe(404);
  });

  it("answers 405 for a known route with the wrong method", async () => {
    const response = await t.request("DELETE", "/v1/courses", { as: "staff" });

    expect(response.status).toBe(405);
    expect((await readJson(response)).error).toMatchObject({ code: "method_not_allowed" });
  });

  it("accepts a trailing slash", async () => {
    expect((await t.request("GET", "/v1/courses/", { as: "staff" })).status).toBe(200);
  });

  it("routes before authenticating, so unknown routes never reach the host's identity", async () => {
    const before = t.identityCalls.length;

    await t.request("GET", "/v1/nothing-here", { as: "staff" });

    expect(t.identityCalls.length).toBe(before);
  });
});

describe("response headers", () => {
  it("never lets learner data be cached and echoes a well-formed request id", async () => {
    const response = await t.request("GET", "/v1/courses", {
      as: "staff",
      headers: { "x-request-id": "trace-123456" },
    });

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("x-request-id")).toBe("trace-123456");
  });

  it("replaces a malformed incoming request id", async () => {
    const response = await t.request("GET", "/v1/courses", {
      as: "staff",
      headers: { "x-request-id": "<script>" },
    });

    expect(response.headers.get("x-request-id")).toMatch(/^req_[0-9a-f-]{36}$/);
  });
});

describe("CSRF origin check", () => {
  it("refuses a state-changing request from another origin", async () => {
    const response = await t.request("POST", "/v1/courses/x/enroll", {
      as: "staff",
      headers: { origin: "https://evil.example.net" },
    });

    expect(response.status).toBe(403);
    expect((await readJson(response)).error).toMatchObject({ code: "origin_not_allowed" });
  });

  it("accepts the request's own origin and requests without origin", async () => {
    const sameOrigin = await t.request("POST", "/v1/courses/x/enroll", {
      as: "staff",
      headers: { origin: ORIGIN },
    });
    const noOrigin = await t.request("POST", "/v1/courses/x/enroll", { as: "staff" });

    expect(sameOrigin.status).toBe(404);
    expect(noOrigin.status).toBe(404);
  });

  it("does not check the origin of reads", async () => {
    const response = await t.request("GET", "/v1/courses", {
      as: "staff",
      headers: { origin: "https://elsewhere.example.net" },
    });

    expect(response.status).toBe(200);
  });

  it("uses the configured allowlist instead of the request origin", async () => {
    const configured = await createTestApp({ allowedOrigins: ["https://app.example.com"] });
    const allowed = await configured.request("POST", "/v1/courses/x/enroll", {
      as: "staff",
      headers: { origin: "https://app.example.com" },
    });
    const own = await configured.request("POST", "/v1/courses/x/enroll", {
      as: "staff",
      headers: { origin: ORIGIN },
    });

    expect(allowed.status).toBe(404);
    expect(own.status).toBe(403);
    await configured.database.drop();
  });
});

describe("unexpected failures", () => {
  it("answers a generic 500 with the request id and logs the error when storage fails", async () => {
    const storage = {
      ...t.database.storage,
      listCourses: () => Promise.reject(new Error("connection reset by peer")),
    };
    const failing = await createTestApp({ storage });

    const response = await failing.request("GET", "/v1/courses", { as: "staff" });
    const body = await readJson(response);

    expect(response.status).toBe(500);
    expect(body.error).toEqual({
      code: "internal_error",
      message: "Something went wrong. Try again later.",
      request_id: response.headers.get("x-request-id"),
    });
    expect(JSON.stringify(body)).not.toContain("connection reset");
    expect(failing.logs).toContainEqual(
      expect.objectContaining({ level: "error", message: "request failed" }),
    );
    await failing.database.drop();
  });
});

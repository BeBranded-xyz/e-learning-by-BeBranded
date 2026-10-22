import { describe, expect, it } from "vitest";

import { postgresStorage } from "@bebranded/elearning-db";

import { resolveOptions } from "./config.js";

// A real adapter: it connects lazily, and these tests never query it.
const storage = postgresStorage({ connectionString: "postgres://localhost:1/unused" });
const identity = () => Promise.resolve(null);

describe("resolveOptions", () => {
  it("applies the documented defaults", () => {
    const options = resolveOptions({ storage, identity });

    expect(options).toMatchObject({
      basePath: "/api/elearning",
      sharedCatalog: false,
      allowedOrigins: undefined,
      events: {},
    });
    expect(options.clock()).toBeInstanceOf(Date);
    expect(options.generateId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("normalizes allowed origins", () => {
    expect(
      resolveOptions({ storage, identity, allowedOrigins: ["https://app.example.com/path"] })
        .allowedOrigins,
    ).toEqual(["https://app.example.com"]);
  });

  it.each([
    ["a missing storage", { identity }],
    ["a storage that is not an adapter", { storage: {}, identity }],
    ["a missing identity resolver", { storage }],
    ["an identity that is not a function", { storage, identity: "session" }],
    ["a base path without leading slash", { storage, identity, basePath: "api" }],
    ["a base path with a trailing slash", { storage, identity, basePath: "/api/" }],
    ["an allowed origin that is not a URL", { storage, identity, allowedOrigins: ["*"] }],
    ["an ftp origin", { storage, identity, allowedOrigins: ["ftp://files.example.com"] }],
    ["an unknown option", { storage, identity, debug: true }],
    [
      "a non-function event handler",
      { storage, identity, events: { "course.completed": "notify" } },
    ],
  ])("rejects %s at startup", (_label, input) => {
    expect(() => resolveOptions(input as never)).toThrow();
  });
});

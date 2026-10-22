import { describe, expect, it } from "vitest";

import { AppError } from "@bebranded/elearning-core";

import { errorResponse, noContent } from "./responses.js";

describe("errorResponse", () => {
  it.each([
    ["validation", "validation_failed", 400],
    ["unauthenticated", "unauthenticated", 401],
    ["forbidden", "forbidden", 403],
    ["not_found", "not_found", 404],
    ["conflict", "slug_taken", 409],
    ["rate_limit", "rate_limited", 429],
    ["validation", "unsupported_media_type", 415],
    ["validation", "payload_too_large", 413],
    ["validation", "method_not_allowed", 405],
  ] as const)("maps %s / %s to %i", (kind, code, status) => {
    expect(errorResponse(new AppError(kind, code, "msg"), "req_1").status).toBe(status);
  });

  it("keeps the details of client errors", async () => {
    const response = errorResponse(
      new AppError("validation", "validation_failed", "Invalid", {
        details: { fields: ["title"] },
      }),
      "req_1",
    );

    expect(await response.json()).toEqual({
      error: {
        code: "validation_failed",
        message: "Invalid",
        details: { fields: ["title"] },
        request_id: "req_1",
      },
    });
  });

  it.each(["internal", "upstream"] as const)(
    "hides the code, message and details of %s errors",
    async (kind) => {
      const response = errorResponse(
        new AppError(kind, "db_down", "SELECT failed on host db-01", { details: { sql: "x" } }),
        "req_2",
      );

      expect(await response.json()).toEqual({
        error: {
          code: "internal_error",
          message: "Something went wrong. Try again later.",
          request_id: "req_2",
        },
      });
    },
  );
});

describe("noContent", () => {
  it("has no body and no content type", async () => {
    const response = noContent("req_3");

    expect(response.status).toBe(204);
    expect(response.headers.get("content-type")).toBeNull();
    expect(response.headers.get("x-request-id")).toBe("req_3");
    expect(await response.text()).toBe("");
  });
});

import { describe, expect, it } from "vitest";

import type { Elearning } from "@bebranded/elearning-server";

import { createElearningRouteHandler } from "./route-handler.js";

describe("createElearningRouteHandler", () => {
  it("forwards every method to the module", async () => {
    const seen: string[] = [];
    const elearning: Elearning = {
      handle: (request) => {
        seen.push(`${request.method} ${new URL(request.url).pathname}`);
        return Promise.resolve(new Response("ok"));
      },
      deliverEvents: () => Promise.resolve({ delivered: 0, failed: 0 }),
    };
    const handlers = createElearningRouteHandler(elearning);

    for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
      const response = await handlers[method](
        new Request("https://h.example.com/api/elearning/v1/courses", { method }),
      );
      expect(await response.text()).toBe("ok");
    }

    expect(seen).toEqual([
      "GET /api/elearning/v1/courses",
      "POST /api/elearning/v1/courses",
      "PATCH /api/elearning/v1/courses",
      "DELETE /api/elearning/v1/courses",
    ]);
  });
});

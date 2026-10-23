import { describe, expect, it } from "vitest";

import { ElearningApiError } from "./api-error.js";
import { createApiClient } from "./client.js";

function recordingFetcher(response: () => Response) {
  const requests: { url: string; init: RequestInit }[] = [];
  return {
    requests,
    fetcher: (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return Promise.resolve(response());
    },
  };
}

const ok = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 });

describe("createApiClient", () => {
  it("calls the versioned routes under the base path, with cookies and no body on GET", async () => {
    const { fetcher, requests } = recordingFetcher(ok({ data: [], next_cursor: null }));

    await createApiClient("/api/elearning/", fetcher).listCourses();

    expect(requests[0]?.url).toBe("/api/elearning/v1/courses");
    expect(requests[0]?.init).toMatchObject({
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    expect(requests[0]?.init.body).toBeUndefined();
  });

  it("trims any number of trailing slashes from the base path, in linear time", async () => {
    const { fetcher, requests } = recordingFetcher(ok({ data: [], next_cursor: null }));

    await createApiClient(`/api${"/".repeat(100_000)}`, fetcher).listCourses();
    await createApiClient("/", fetcher).listCourses();

    expect(requests.map((request) => request.url)).toEqual(["/api/v1/courses", "/v1/courses"]);
  });

  it("sends JSON on POST (the server's CSRF check requires it)", async () => {
    const { fetcher, requests } = recordingFetcher(ok({ status: "completed" }));

    await createApiClient("/api/elearning", fetcher).completeLesson("lesson-1");

    expect(requests[0]).toMatchObject({
      url: "/api/elearning/v1/lessons/lesson-1/complete",
      init: { method: "POST", body: "{}", headers: { "content-type": "application/json" } },
    });
  });

  it("encodes path segments", async () => {
    const { fetcher, requests } = recordingFetcher(ok({}));

    await createApiClient("/api", fetcher).getCourse("a/../b?x");

    expect(requests[0]?.url).toBe("/api/v1/courses/a%2F..%2Fb%3Fx");
  });

  it("forwards the abort signal", async () => {
    const { fetcher, requests } = recordingFetcher(ok({}));
    const controller = new AbortController();

    await createApiClient("/api", fetcher).getLesson("l", controller.signal);

    expect(requests[0]?.init.signal).toBe(controller.signal);
  });

  it("throws the API error with its code, status and request id", async () => {
    const body = {
      error: { code: "completion_not_manual", message: "Not manual", request_id: "req_1" },
    };
    const { fetcher } = recordingFetcher(
      () =>
        new Response(JSON.stringify(body), { status: 409, headers: { "x-request-id": "req_1" } }),
    );

    const error: unknown = await createApiClient("/api", fetcher)
      .completeLesson("l")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ElearningApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "completion_not_manual",
      message: "Not manual",
      requestId: "req_1",
    });
  });

  it.each([
    ["an HTML error page", "<html>Bad gateway</html>"],
    ["JSON without the envelope", JSON.stringify({ message: "nope" })],
    ["an envelope with a wrong shape", JSON.stringify({ error: { code: 42 } })],
  ])("reports %s as unexpected_response", async (_label, text) => {
    const { fetcher } = recordingFetcher(() => new Response(text, { status: 502 }));

    await expect(createApiClient("/api", fetcher).myProgress()).rejects.toMatchObject({
      status: 502,
      code: "unexpected_response",
      requestId: null,
    });
  });
});

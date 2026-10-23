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

  it("opens and submits quiz attempts on their routes", async () => {
    const { fetcher, requests } = recordingFetcher(ok({}));
    const api = createApiClient("/api", fetcher);

    await api.openQuizAttempt("lesson-1");
    await api.submitQuizAttempt("lesson-1", "attempt/1", { q1: true });

    expect(requests.map((request) => [request.url, request.init.body])).toEqual([
      ["/api/v1/lessons/lesson-1/quiz/attempts", "{}"],
      ["/api/v1/lessons/lesson-1/quiz/attempts/attempt%2F1/submit", '{"answers":{"q1":true}}'],
    ]);
  });

  it("keeps the details of an error, and nothing that is not an object", async () => {
    const reply = (details: unknown) => () =>
      new Response(JSON.stringify({ error: { code: "cooldown", message: "Wait", details } }), {
        status: 429,
      });
    const errorFor = (details: unknown) =>
      createApiClient("/api", recordingFetcher(reply(details)).fetcher)
        .openQuizAttempt("l")
        .catch((caught: unknown) => caught);

    expect(await errorFor({ next_attempt_at: "2026-10-23T10:00:00.000Z" })).toMatchObject({
      details: { next_attempt_at: "2026-10-23T10:00:00.000Z" },
    });
    expect(await errorFor(["x"])).toMatchObject({ details: {} });
    expect(await errorFor(undefined)).toMatchObject({ details: {} });
  });
});

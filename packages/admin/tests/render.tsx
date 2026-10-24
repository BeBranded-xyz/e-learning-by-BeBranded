import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import axe from "axe-core";
import type { ReactElement } from "react";

import { ElearningAdminProvider } from "../src/index.js";

type Reply = { status?: number; body?: unknown };
/** Replies by "METHOD /path" below /v1/admin (or /v1 for learner routes); functions see the body. */
export type FakeAdminApi = Record<string, Reply | ((body: unknown) => Reply | Promise<Reply>)>;
export type RecordedRequest = { key: string; body: unknown };

function fakeAdminFetcher(api: FakeAdminApi) {
  const requests: RecordedRequest[] = [];
  const fetcher = async (input: string, init: RequestInit): Promise<Response> => {
    const url = new URL(input, "https://host.example.com");
    const path = url.pathname.replace(/^\/api\/elearning\/v1(\/admin)?/, "");
    const key = `${init.method ?? "GET"} ${path}`;
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : null;
    requests.push({ key, body });
    const entry = api[key];
    const reply = typeof entry === "function" ? await entry(body) : entry;
    if (reply === undefined) {
      const notFound = {
        error: { code: "not_found", message: "Not found", request_id: "req_test" },
      };
      return Response.json(notFound, { status: 404 });
    }
    const status = reply.status ?? 200;
    if (status === 204) return new Response(null, { status });
    return Response.json(reply.body ?? {}, { status });
  };
  return { fetcher, requests };
}

export function renderAdmin(
  ui: ReactElement,
  api: FakeAdminApi,
  locale = "en",
): RenderResult & { requests: RecordedRequest[] } {
  const fake = fakeAdminFetcher(api);
  const result: RenderResult = render(
    <ElearningAdminProvider apiBase="/api/elearning" locale={locale} fetcher={fake.fetcher}>
      {ui}
    </ElearningAdminProvider>,
  );
  return { ...result, requests: fake.requests };
}

/** axe on the rendered DOM, WCAG 2.2 AA tags (modules/frontend). */
export async function a11yViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

export const apiError = (code: string, status = 409) => ({
  status,
  body: { error: { code, message: "technical", request_id: "req_test" } },
});

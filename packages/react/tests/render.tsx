import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import axe from "axe-core";
import type { ReactElement } from "react";

import { ElearningProvider } from "../src/index.js";
import type { ElearningProviderProps } from "../src/index.js";

type Reply = { status?: number; body: unknown };
export type FakeApi = Record<string, Reply | (() => Reply)>;

/**
 * Fake HTTP boundary: answers by "METHOD /path" and records every request.
 * Components and hooks run for real against it.
 */
export type RecordedRequest = { key: string; body: unknown; keepalive: boolean };

function fakeFetcher(api: FakeApi) {
  const calls: string[] = [];
  const requests: RecordedRequest[] = [];
  const fetcher = (input: string, init: RequestInit): Promise<Response> => {
    const key = `${init.method ?? "GET"} ${new URL(input, "https://host.example.com").pathname.replace("/api/elearning/v1", "")}`;
    calls.push(key);
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : null;
    requests.push({ key, body, keepalive: init.keepalive === true });
    const entry = api[key];
    const reply =
      typeof entry === "function"
        ? entry()
        : (entry ?? {
            status: 404,
            body: { error: { code: "not_found", message: "Not found", request_id: "req_test" } },
          });
    return Promise.resolve(
      new Response(JSON.stringify(reply.body), {
        status: reply.status ?? 200,
        headers: { "content-type": "application/json", "x-request-id": "req_test" },
      }),
    );
  };
  return { fetcher, calls, requests };
}

export function renderWithProvider(
  ui: ReactElement,
  api: FakeApi,
  props: Partial<ElearningProviderProps> = {},
): RenderResult & { calls: string[]; requests: RecordedRequest[] } {
  const { fetcher, calls, requests } = fakeFetcher(api);
  const result = render(
    <ElearningProvider apiBase="/api/elearning" fetcher={fetcher} {...props}>
      {ui}
    </ElearningProvider>,
  );
  return { ...result, calls, requests };
}

/** Runs axe on the rendered DOM and returns the violations (WCAG 2.x A and AA rules). */
export async function a11yViolations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

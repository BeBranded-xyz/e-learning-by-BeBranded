import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCatalog } from "../hooks/queries.js";
import type { Fetcher } from "../api/client.js";
import { ElearningProvider } from "./ElearningProvider.js";

function CatalogProbe() {
  const catalog = useCatalog();
  return <p>{catalog.data?.data[0]?.title ?? "Loading"}</p>;
}

describe("ElearningProvider session isolation", () => {
  it("cancels old session requests and never shows their late responses", async () => {
    let resolveOld: (response: Response) => void = () => undefined;
    let oldSignal: AbortSignal | null | undefined;
    const oldFetcher: Fetcher = (_url, options) => {
      oldSignal = options.signal;
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    };
    const newFetcher: Fetcher = () =>
      Promise.resolve(Response.json({ data: [{ title: "New session" }], next_cursor: null }));
    const { rerender } = render(
      <ElearningProvider apiBase="/api" sessionKey="tenant-a:learner-a" fetcher={oldFetcher}>
        <CatalogProbe />
      </ElearningProvider>,
    );
    await waitFor(() => {
      expect(oldSignal).toBeDefined();
    });

    rerender(
      <ElearningProvider apiBase="/api" sessionKey="tenant-b:learner-b" fetcher={newFetcher}>
        <CatalogProbe />
      </ElearningProvider>,
    );
    await screen.findByText("New session");
    await act(async () => {
      resolveOld(Response.json({ data: [{ title: "Old private data" }], next_cursor: null }));
      await Promise.resolve();
    });

    expect(oldSignal?.aborted).toBe(true);
    expect(screen.queryByText("Old private data")).toBeNull();
    expect(screen.getByText("New session")).toBeDefined();
  });

  it("discards the previous API's catalog when its base changes", async () => {
    const fetcher = vi.fn((url: string) =>
      Promise.resolve(Response.json({ data: [{ title: url }], next_cursor: null })),
    );
    const { rerender } = render(
      <ElearningProvider apiBase="/tenant-a" fetcher={fetcher}>
        <CatalogProbe />
      </ElearningProvider>,
    );
    await screen.findByText("/tenant-a/v1/courses");

    rerender(
      <ElearningProvider apiBase="/tenant-b" fetcher={fetcher}>
        <CatalogProbe />
      </ElearningProvider>,
    );

    expect(screen.queryByText("/tenant-a/v1/courses")).toBeNull();
    await screen.findByText("/tenant-b/v1/courses");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

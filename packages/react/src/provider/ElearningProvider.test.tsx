import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ElearningApiError } from "../api/api-error.js";
import { ElearningProvider, shouldRetry } from "./ElearningProvider.js";
import { useElearning } from "./context.js";

function Probe() {
  const { i18n } = useElearning();
  return <p>{i18n.t("state.loading")}</p>;
}

describe("ElearningProvider", () => {
  it("applies the theme as CSS variables and the locale as lang", () => {
    const { container } = render(
      <ElearningProvider
        apiBase="/api/elearning"
        locale="fr"
        theme={{ colors: { primary: "#123456" } }}
      >
        <Probe />
      </ElearningProvider>,
    );

    const root = container.querySelector(".el-root");
    expect(root?.getAttribute("lang")).toBe("fr");
    expect(root?.getAttribute("style")).toContain("--el-color-primary: #123456");
    expect(screen.getByText("Chargement…")).toBeDefined();
  });

  it("makes components outside the provider fail with a clear message", () => {
    expect(() => render(<Probe />)).toThrow("Wrap e-learning components in <ElearningProvider>.");
  });
});

describe("shouldRetry", () => {
  it.each([
    [0, new ElearningApiError(500, "internal_error", "x", { requestId: null }), true],
    [0, new TypeError("Failed to fetch"), true],
    [1, new ElearningApiError(503, "x", "x", { requestId: null }), false],
    [0, new ElearningApiError(404, "not_found", "x", { requestId: null }), false],
    [0, new ElearningApiError(401, "unauthenticated", "x", { requestId: null }), false],
  ])("after %i failures with %o retries: %s", (count, error, expected) => {
    expect(shouldRetry(count, error)).toBe(expected);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testDesign } from "../../tests/design.js";
import { ElearningApiError } from "../api/api-error.js";
import { useUi } from "../ui/kit.js";
import type { UiButtonProps } from "../ui/kit.types.js";
import { ElearningProvider, shouldRetry } from "./ElearningProvider.js";
import { useElearning } from "./context.js";

function Probe() {
  const { i18n } = useElearning();
  return <p>{i18n.t("state.loading")}</p>;
}

describe("ElearningProvider", () => {
  it("applies the locale as lang and renders no design without one", () => {
    const { container } = render(
      <ElearningProvider apiBase="/api/elearning" locale="fr">
        <Probe />
      </ElearningProvider>,
    );

    expect(container.querySelector(".el-root")?.getAttribute("lang")).toBe("fr");
    expect(container.querySelector("style")).toBeNull();
    expect(screen.getByText("Chargement…")).toBeDefined();
  });

  it("renders the design's variables, scoped to its root, with the CSP nonce", () => {
    const { container } = render(
      <ElearningProvider apiBase="/api/elearning" design={testDesign} nonce="abc">
        <Probe />
      </ElearningProvider>,
    );

    const style = container.querySelector("style");
    expect(style?.getAttribute("nonce")).toBe("abc");
    expect(style?.textContent).toContain(".el-root {");
    expect(style?.textContent).toContain("--el-color-primary: #654321;");
  });

  it("completes a host's partial kit with the default kit", () => {
    function HostButton(props: UiButtonProps) {
      return (
        <button type="button" data-host="yes" onClick={props.onClick}>
          {props.children}
        </button>
      );
    }
    function Primitives() {
      const { Button, Badge } = useUi();
      return (
        <>
          <Button>Go</Button>
          <Badge>New</Badge>
        </>
      );
    }
    render(
      <ElearningProvider apiBase="/api/elearning" ui={{ Button: HostButton }}>
        <Primitives />
      </ElearningProvider>,
    );

    expect(screen.getByRole("button", { name: "Go" }).getAttribute("data-host")).toBe("yes");
    expect(screen.getByText("New").className).toBe("el-tag");
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

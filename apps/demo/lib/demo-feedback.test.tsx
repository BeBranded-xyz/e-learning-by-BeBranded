import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ScriptProps } from "next/script";
import { DemoFeedback } from "../components/demo-feedback";
import { readEnv } from "./env";

vi.mock("next/script", () => ({
  default: ({ strategy, ...props }: ScriptProps) => <script data-strategy={strategy} {...props} />,
}));
function render(ui: ReactElement) {
  return { container: new DOMParser().parseFromString(renderToStaticMarkup(ui), "text/html") };
}
const base = {
  NODE_ENV: "test" as const,
  ELEARNING_DATABASE_URL: "postgres://example:example@example.com/demo",
};

describe("demo feedback", () => {
  it.each([undefined, ""])("is disabled without an identifier (%s)", (key) => {
    const config = readEnv({ ...base, DEMO_DASHLY_WIDGET_KEY: key });
    const { container } = render(<DemoFeedback widgetKey={config.DEMO_DASHLY_WIDGET_KEY} />);
    expect(container.querySelector("script")).toBeNull();
  });

  it("loads only the vendor script asynchronously with the configured public identifier", () => {
    const config = readEnv({ ...base, DEMO_DASHLY_WIDGET_KEY: "ws_k_example" });
    const { container } = render(<DemoFeedback widgetKey={config.DEMO_DASHLY_WIDGET_KEY} />);
    const script = container.querySelector("script");
    expect(script?.src).toBe("https://app.usedashly.com/widget/v1.js");
    expect(script?.getAttribute("data-key")).toBe("ws_k_example");
    expect(script?.getAttribute("data-strategy")).toBe("afterInteractive");
    expect(script?.hasAttribute("async")).toBe(true);
  });

  it.each(["invalid", "ws_k_<script>", " ws_k_example", "ws_k_"])(
    "refuses malformed identifier %s",
    (key) => {
      expect(() => readEnv({ ...base, DEMO_DASHLY_WIDGET_KEY: key })).toThrow(
        /DEMO_DASHLY_WIDGET_KEY/,
      );
    },
  );
});

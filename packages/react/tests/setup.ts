import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount what each test rendered (Testing Library cleans up automatically only with globals).
afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver; SurveyJS observes its container size for responsive layout.
// Nothing resizes in jsdom, so observing does nothing.
class NoopResizeObserver {
  observe(): void {
    return undefined;
  }
  unobserve(): void {
    return undefined;
  }
  disconnect(): void {
    return undefined;
  }
}
if (!("ResizeObserver" in globalThis)) {
  Object.assign(globalThis, { ResizeObserver: NoopResizeObserver });
}

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApiLessonPreview } from "@bebranded/elearning-core";
import { quizAttempt } from "../../tests/fixtures.js";
import { a11yViolations, renderWithProvider } from "../../tests/render.js";
import { LessonPreviewContent } from "./LessonPreviewContent.js";

const preview: ApiLessonPreview = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Draft lesson",
  type: "text",
  html: "<p>Saved introduction.</p>",
  video: null,
  survey: null,
};

describe("LessonPreviewContent", { timeout: 20_000 }, () => {
  it("renders saved text accessibly without any learner request", async () => {
    const { container, requests } = renderWithProvider(
      <LessonPreviewContent preview={preview} />,
      {},
    );
    expect(screen.getByText("Saved introduction.")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
    expect(await a11yViolations(container)).toEqual([]);
    expect(requests).toEqual([]);
  });

  it("explains a video that is not ready without starting a session", () => {
    const { requests } = renderWithProvider(
      <LessonPreviewContent preview={{ ...preview, type: "video" }} />,
      {},
    );
    expect(screen.getByText(/video.*being prepared/i)).toBeDefined();
    expect(requests).toEqual([]);
  });

  it("explains a quiz with no saved questions", () => {
    const { requests } = renderWithProvider(
      <LessonPreviewContent preview={{ ...preview, type: "quiz" }} />,
      {},
    );
    expect(screen.getByText(/quiz has no questions/i)).toBeDefined();
    expect(requests).toEqual([]);
  });

  it("renders a read-only quiz without attempts, grading, or submission controls", async () => {
    const { container, requests } = renderWithProvider(
      <LessonPreviewContent preview={{ ...preview, type: "quiz", survey: quizAttempt.survey }} />,
      {},
    );
    await screen.findByText(/Exit signs are green/);
    expect(screen.getByText(/Which color marks an exit/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /submit|complete|start/i })).toBeNull();
    expect(await a11yViolations(container)).toEqual([]);
    expect(requests).toEqual([]);
  });
});

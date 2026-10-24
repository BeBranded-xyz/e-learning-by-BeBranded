import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { course, tree, COURSE_ID } from "../../tests/fixtures.js";
import { aLesson } from "../../tests/lessons.js";
import { a11yViolations, apiError, renderAdmin } from "../../tests/render.js";
import { CompletionSettings } from "./CompletionSettings.js";
import { LessonValidation } from "./LessonValidation.js";
import { LessonPreview } from "./LessonPreview.js";
import { CourseWorkspace } from "./CourseWorkspace.js";

const lesson = aLesson();
const preview = {
  id: lesson.id,
  title: lesson.title,
  type: "text",
  html: "<p>Saved draft content</p>",
  video: null,
  survey: null,
};

describe("authoring", () => {
  it("saves a course percentage with accessible feedback", async () => {
    const { requests, container } = renderAdmin(<CompletionSettings course={course} />, {
      [`PATCH /courses/${COURSE_ID}`]: { body: course },
      "GET /courses": { body: { data: [] } },
      [`GET /courses/${COURSE_ID}`]: { body: tree },
    });
    await userEvent.selectOptions(screen.getByLabelText("Complete the course when"), "percentage");
    await userEvent.clear(screen.getByLabelText("Required course completion (%)"));
    await userEvent.type(screen.getByLabelText("Required course completion (%)"), "80");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    expect(requests.find((request) => request.key.startsWith("PATCH"))?.body).toEqual({
      completion_rule: { type: "percentage", threshold: 0.8 },
    });
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("saves video coverage and required status with the real settings contract", async () => {
    const video = aLesson({ type: "video", settings: {} });
    const { requests } = renderAdmin(<LessonValidation lesson={video} />, {
      "PATCH /lessons/a": { body: video },
    });
    await userEvent.clear(screen.getByLabelText("Video that must be watched (%)"));
    await userEvent.type(screen.getByLabelText("Video that must be watched (%)"), "80");
    await userEvent.click(screen.getByLabelText("Required to complete the course"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    expect(requests.find((request) => request.key === "PATCH /lessons/a")?.body).toEqual({
      is_required: false,
      settings: {
        completionThreshold: 0.8,
        maxPlaybackRate: 2,
        allowSeeking: true,
        pauseWhenHidden: false,
      },
    });
  });

  it("exposes quiz score, unlimited limits, correction and randomization settings", async () => {
    const quiz = aLesson({ type: "quiz", settings: {} });
    const { requests } = renderAdmin(<LessonValidation lesson={quiz} />, {
      "PATCH /lessons/a": { body: quiz },
    });
    await userEvent.clear(screen.getByLabelText("Quiz passing score (%)"));
    await userEvent.type(screen.getByLabelText("Quiz passing score (%)"), "75");
    await userEvent.type(screen.getByLabelText("Maximum attempts (empty for unlimited)"), "3");
    await userEvent.selectOptions(screen.getByLabelText("Show quiz corrections"), "after_pass");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    expect(requests.find((request) => request.key === "PATCH /lessons/a")?.body).toMatchObject({
      settings: {
        passingScore: 0.75,
        maxAttempts: 3,
        timeLimitMinutes: null,
        showCorrection: "after_pass",
      },
    });
  });

  it("previews saved content, changes device width, and performs GETs only", async () => {
    const { container, requests } = renderAdmin(<LessonPreview lessonId={lesson.id} />, {
      "GET /lessons/a/preview": { body: preview },
    });
    await screen.findByText("Saved draft content");
    await userEvent.click(screen.getByRole("button", { name: "Mobile" }));
    expect(screen.getByRole("button", { name: "Mobile" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Refresh preview" }));
    await waitFor(() => {
      expect(requests.length).toBe(2);
    });
    expect(requests.every((request) => request.key === "GET /lessons/a/preview")).toBe(true);
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("shows a preview error with retry", async () => {
    renderAdmin(<LessonPreview lessonId={lesson.id} />, {
      "GET /lessons/a/preview": apiError("internal_error", 500),
    });
    expect(
      await screen.findByRole("button", { name: "Try again" }, { timeout: 3000 }),
    ).toBeDefined();
  });

  it("keeps unsaved course settings when switching sections and names the chapter controls", async () => {
    renderAdmin(
      <CourseWorkspace courseId={COURSE_ID} lessonHref={(item) => `/lessons/${item.id}`} />,
      { [`GET /courses/${COURSE_ID}`]: { body: tree } },
    );
    await screen.findByRole("heading", { name: "Safety basics" });
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "My unsaved title");
    await userEvent.click(screen.getByRole("button", { name: "Structure" }));
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("My unsaved title");
    expect(screen.getByLabelText("New chapter title")).toBeDefined();
  });
});

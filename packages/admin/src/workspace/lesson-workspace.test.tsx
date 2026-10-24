import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { COURSE_ID, tree } from "../../tests/fixtures.js";
import { aLesson } from "../../tests/lessons.js";
import { apiError, renderAdmin } from "../../tests/render.js";
import { LessonWorkspace } from "./LessonWorkspace.js";
import { CourseWorkspace } from "./CourseWorkspace.js";
import { CompletionSettings } from "./CompletionSettings.js";

const lesson = aLesson();
const preview = {
  id: lesson.id,
  title: lesson.title,
  type: "text",
  html: "<p>Saved draft</p>",
  video: null,
  survey: null,
};
const replies = {
  "GET /lessons/a": { body: lesson },
  [`GET /courses/${COURSE_ID}`]: { body: tree },
  "GET /lessons/a/preview": { body: preview },
};

describe("lesson workspace", () => {
  it("edits content and settings in separate sections, without overwriting required status", async () => {
    const { requests } = renderAdmin(
      <LessonWorkspace lessonId="a" courseHref={(id) => `/courses/${id}`} />,
      {
        ...replies,
        "PATCH /lessons/a": { body: lesson },
      },
    );
    await screen.findByRole("heading", { name: lesson.title });
    expect(screen.getByRole("link", { name: "Back to the course" }).getAttribute("href")).toBe(
      `/courses/${COURSE_ID}`,
    );
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Revised title");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    const body = requests.find((item) => item.key === "PATCH /lessons/a")?.body;
    expect(body).toMatchObject({ title: "Revised title" });
    expect(body).not.toHaveProperty("is_required");
    await userEvent.click(screen.getByRole("button", { name: "Access" }));
    expect(screen.getByText(/inherit/i)).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Completion" }));
    expect(screen.getByLabelText("Required to complete the course")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByText("Saved draft");
  });

  it("keeps shared lessons read-only and still allows saved draft preview", async () => {
    renderAdmin(<LessonWorkspace lessonId="a" />, {
      ...replies,
      [`GET /courses/${COURSE_ID}`]: { body: { ...tree, editable: false } },
    });
    await screen.findByText("Saved draft");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Content" })).toBeNull();
  });

  it("uses a host-controlled section callback", async () => {
    const onSectionChange = vi.fn();
    renderAdmin(
      <LessonWorkspace lessonId="a" section="preview" onSectionChange={onSectionChange} />,
      replies,
    );
    await screen.findByText("Saved draft");
    await userEvent.click(screen.getByRole("button", { name: "Content" }));
    expect(onSectionChange).toHaveBeenCalledWith("content");
  });

  it("reports a missing parent course", async () => {
    renderAdmin(<LessonWorkspace lessonId="a" />, {
      ...replies,
      [`GET /courses/${COURSE_ID}`]: apiError("not_found", 404),
    });
    await screen.findByRole("alert");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reports a missing course in the course workspace", async () => {
    renderAdmin(<CourseWorkspace courseId={COURSE_ID} lessonHref={() => "/lesson"} />, {
      [`GET /courses/${COURSE_ID}`]: apiError("not_found", 404),
    });
    await screen.findByRole("alert");
  });

  it("keeps shared course completion settings read-only", async () => {
    renderAdmin(
      <CompletionSettings
        course={{
          ...tree,
          editable: false,
          completion_rule: { type: "percentage", threshold: 0.8 },
        }}
      />,
      {},
    );
    const input = screen.getByLabelText<HTMLInputElement>("Required course completion (%)");
    expect(input.disabled).toBe(true);
    expect(input.value).toBe("80");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    });
  });
});

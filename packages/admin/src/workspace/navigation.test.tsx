import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { COURSE_ID, tree } from "../../tests/fixtures.js";
import { aLesson } from "../../tests/lessons.js";
import { apiError, renderAdmin } from "../../tests/render.js";
import { AuthorNavigation } from "./AuthorNavigation.js";
import { CoursePreview } from "./CoursePreview.js";
import { LessonWorkspace } from "./LessonWorkspace.js";

const courseHref = (id: string) => `/courses/${id}`;
const lessonHref = (id: string) => `/lessons/${id}`;
const preview = {
  id: "a",
  title: "Draft",
  type: "text",
  html: "<p>Saved A</p>",
  video: null,
  survey: null,
};

describe("author navigation", () => {
  it("links the catalog, creation and the current lesson in its course outline", async () => {
    renderAdmin(
      <AuthorNavigation
        lessonId="a"
        catalogHref="/admin"
        courseHref={courseHref}
        lessonHref={lessonHref}
      />,
      {
        "GET /courses": { body: { data: [tree] } },
        "GET /lessons/a": { body: aLesson() },
        [`GET /courses/${COURSE_ID}`]: { body: tree },
      },
    );
    const lesson = await screen.findByRole("link", { name: "Open Lesson a" });
    expect(lesson.getAttribute("href")).toBe("/lessons/a");
    expect(lesson.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Create a course/ }).getAttribute("href")).toBe(
      "/admin#new-course",
    );
    expect(screen.getByRole("link", { name: /Create a chapter/ }).getAttribute("href")).toContain(
      "section=structure#new-chapter",
    );
  });

  it("previews any lesson of a course, including a draft chapter", async () => {
    renderAdmin(<CoursePreview course={tree} />, {
      "GET /lessons/a/preview": { body: preview },
      "GET /lessons/c/preview": { body: { ...preview, id: "c", html: "<p>Saved C</p>" } },
    });
    await screen.findByText("Saved A");
    await userEvent.selectOptions(screen.getByLabelText("Choose a lesson to preview"), "c");
    await screen.findByText("Saved C");
  });

  it("guides an empty course toward creating its first lesson", () => {
    renderAdmin(<CoursePreview course={{ ...tree, chapters: [] }} />, {});
    expect(screen.getByText(/Add a chapter/)).toBeDefined();
  });

  it("shows a missing lesson instead of waiting forever for its course", async () => {
    renderAdmin(<LessonWorkspace lessonId="missing" />, {
      "GET /lessons/missing": apiError("not_found", 404),
    });
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

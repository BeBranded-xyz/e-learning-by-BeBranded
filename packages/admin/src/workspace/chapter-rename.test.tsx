import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, it } from "vitest";
import { COURSE_ID, tree } from "../../tests/fixtures.js";
import { renderAdmin } from "../../tests/render.js";
import { CourseWorkspace } from "./CourseWorkspace.js";

it("keeps saved feedback after the chapter heading refreshes to its new title", async () => {
  let current = tree;
  renderAdmin(<CourseWorkspace courseId={COURSE_ID} lessonHref={() => "/lesson"} />, {
    [`GET /courses/${COURSE_ID}`]: () => ({ body: current }),
    "PATCH /chapters/c1": () => {
      current = {
        ...tree,
        chapters: tree.chapters.map((chapter) =>
          chapter.id === "c1" ? { ...chapter, title: "Introduction" } : chapter,
        ),
      };
      return { body: current.chapters[0] };
    },
  });
  const chapter = await screen.findByRole("listitem", { name: "Basics" });
  await userEvent.click(
    within(chapter).getByLabelText("Actions for Basics", { selector: "summary" }),
  );
  await userEvent.click(within(chapter).getByText("Edit", { selector: "summary" }));
  const form = within(chapter).getByRole("form", { name: "Edit: Basics" });
  await userEvent.clear(within(form).getByLabelText("Chapter title"));
  await userEvent.type(within(form).getByLabelText("Chapter title"), "Introduction");
  await userEvent.click(within(form).getByRole("button", { name: "Save" }));
  await screen.findByRole("heading", { name: "Introduction" });
  expect(await screen.findByText("Saved")).toBeDefined();
});

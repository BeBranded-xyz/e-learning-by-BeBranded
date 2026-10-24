import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, it } from "vitest";
import { tree, COURSE_ID } from "../../tests/fixtures.js";
import { renderAdmin, a11yViolations } from "../../tests/render.js";
import { CourseWorkspace } from "./CourseWorkspace.js";

it("exposes linked keyboard tabs while retaining unsaved settings", async () => {
  const { container } = renderAdmin(
    <CourseWorkspace courseId={COURSE_ID} lessonHref={() => "/lesson"} />,
    {
      [`GET /courses/${COURSE_ID}`]: { body: tree },
    },
  );
  const structure = await screen.findByRole("tab", { name: "Structure" });
  expect(structure.getAttribute("aria-selected")).toBe("true");
  structure.focus();
  await userEvent.keyboard("{ArrowRight}");
  const settings = screen.getByRole("tab", { name: "Settings" });
  expect(document.activeElement).toBe(settings);
  expect(settings.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel", { name: "Settings" }).id).toBe(
    settings.getAttribute("aria-controls"),
  );
  await userEvent.type(screen.getByLabelText("Title"), " edited");
  await userEvent.click(structure);
  await userEvent.click(settings);
  expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Safety basics edited");
  expect(await a11yViolations(container)).toEqual([]);
});

it.each([
  ["{ArrowLeft}", "Preview"],
  ["{End}", "Preview"],
  ["{Home}", "Structure"],
  ["{ArrowDown}", "Structure"],
])("handles %s from the first tab as %s", async (key, expected) => {
  renderAdmin(<CourseWorkspace courseId={COURSE_ID} lessonHref={() => "/lesson"} />, {
    [`GET /courses/${COURSE_ID}`]: { body: tree },
  });
  (await screen.findByRole("tab", { name: "Structure" })).focus();
  await userEvent.keyboard(key);
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: expected }));
  expect(screen.getByRole("tab", { name: expected }).getAttribute("aria-selected")).toBe("true");
});

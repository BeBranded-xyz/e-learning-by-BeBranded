import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { it, expect } from "vitest";
import { tree } from "../../tests/fixtures.js";
import { renderAdmin } from "../../tests/render.js";
import { ContentTree } from "./ContentTree.js";

it("shows chapter content first and opens secondary actions and creation only on demand", async () => {
  renderAdmin(<ContentTree course={tree} lessonHref={(lesson) => `/lessons/${lesson.id}`} />, {});
  // jsdom does not apply the browser's closed-details rendering rules.
  expect(
    screen
      .getAllByRole("form", { name: "Add a lesson" })
      .every((form) => form.closest("details")?.open === false),
  ).toBe(true);
  expect(screen.getByRole("button", { name: "Back to draft" }).closest("details")?.open).toBe(
    false,
  );
  const chapter = screen.getByRole("listitem", { name: "Basics" });
  await userEvent.click(within(chapter).getByText("Add a lesson", { selector: "summary" }));
  expect(within(chapter).getByRole("form", { name: "Add a lesson" })).toBeDefined();
  await userEvent.click(
    within(chapter).getByLabelText("Actions for Basics", { selector: "summary" }),
  );
  expect(within(chapter).getByRole("button", { name: "Back to draft" })).toBeDefined();
});

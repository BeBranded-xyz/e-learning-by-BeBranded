import { fireEvent, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { tree } from "../../tests/fixtures.js";
import { renderAdmin } from "../../tests/render.js";
import { ContentTree } from "./ContentTree.js";

function actionMenu() {
  renderAdmin(<ContentTree course={tree} lessonHref={() => "/lesson"} />, {});
  const chapter = screen.getByRole("listitem", { name: "Basics" });
  const trigger = within(chapter).getByLabelText("Actions for Basics", { selector: "summary" });
  const details = trigger.closest("details");
  if (details === null) throw new Error("Missing action disclosure");
  return { trigger, details };
}

it("dismisses with Escape immediately after the native disclosure opens", () => {
  const { trigger, details } = actionMenu();
  fireEvent.click(trigger);
  expect(details.open).toBe(true);
  // The native toggle event is queued; the next key must not wait for React to observe it.
  fireEvent.keyDown(document, { key: "Escape" });
  expect(details.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it("dismisses an immediate outside press while retaining presses inside the disclosure", () => {
  const { trigger, details } = actionMenu();
  fireEvent.click(trigger);
  fireEvent.pointerDown(trigger);
  expect(details.open).toBe(true);
  fireEvent.pointerDown(document.body);
  expect(details.open).toBe(false);
});

it("leaves focus alone for other keys and Escape while the disclosure is closed", () => {
  const { trigger, details } = actionMenu();
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(details.open).toBe(true);
  details.open = false;
  document.body.setAttribute("tabindex", "-1");
  document.body.focus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(document.activeElement).toBe(document.body);
  document.body.removeAttribute("tabindex");
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { COURSE_ID, tree } from "../../tests/fixtures.js";
import { a11yViolations, apiError, renderAdmin } from "../../tests/render.js";
import { ContentTree } from "./ContentTree.js";

const lessonHref = (lesson: { id: string }) => `/admin/lessons/${lesson.id}`;
const reorderBodyOf = (requests: { key: string; body: unknown }[]) =>
  requests.find((request) => request.key === "POST /reorder")?.body;

function renderTree(api = {}) {
  return renderAdmin(<ContentTree course={tree} lessonHref={lessonHref} />, {
    "POST /reorder": { body: tree },
    ...api,
  });
}

describe("ContentTree", () => {
  it("shows chapters and lessons with their type, status and links, without a11y violation", async () => {
    const { container } = renderTree();

    const basics = screen.getByRole("listitem", { name: "Basics" });
    expect(within(basics).getByRole("link", { name: "Lesson a" }).getAttribute("href")).toBe(
      "/admin/lessons/a",
    );
    const quiz = screen.getByRole("link", { name: "Lesson b" }).closest("li");
    expect(quiz?.textContent).toContain("Quiz");
    expect(screen.getByRole("link", { name: "Lesson c" }).closest("li")?.textContent).toContain(
      "Video",
    );
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("moves a lesson down with its button and announces it", async () => {
    const { requests } = renderTree();

    await userEvent.click(screen.getByRole("button", { name: "Move Lesson a down" }));

    await waitFor(() => {
      expect(reorderBodyOf(requests)).toEqual({
        course_id: COURSE_ID,
        chapters: [
          { id: "c1", lesson_ids: ["b", "a"] },
          { id: "c2", lesson_ids: ["c"] },
        ],
      });
    });
    expect(await screen.findByText("Lesson a moved.")).toBeDefined();
  });

  it("moves the last lesson of a chapter into the next one", async () => {
    const { requests } = renderTree();

    await userEvent.click(screen.getByRole("button", { name: "Move Lesson b down" }));

    await waitFor(() => {
      expect(reorderBodyOf(requests)).toMatchObject({
        chapters: [
          { id: "c1", lesson_ids: ["a"] },
          { id: "c2", lesson_ids: ["b", "c"] },
        ],
      });
    });
  });

  it("moves a chapter up", async () => {
    const { requests } = renderTree();

    await userEvent.click(screen.getByRole("button", { name: "Move Practice up" }));

    await waitFor(() => {
      expect(reorderBodyOf(requests)).toMatchObject({
        chapters: [{ id: "c2" }, { id: "c1" }],
      });
    });
  });

  it("does not call the server for a move that changes nothing", async () => {
    const { requests } = renderTree();

    await userEvent.click(screen.getByRole("button", { name: "Move Basics up" }));

    expect(reorderBodyOf(requests)).toBeUndefined();
  });

  it("drops a dragged lesson before another lesson, or at the end of a chapter", async () => {
    const { requests } = renderTree();

    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(screen.getByRole("link", { name: "Lesson c" }), { dataTransfer });
    fireEvent.drop(screen.getByRole("link", { name: "Lesson a" }));

    await waitFor(() => {
      expect(reorderBodyOf(requests)).toMatchObject({
        chapters: [
          { id: "c1", lesson_ids: ["c", "a", "b"] },
          { id: "c2", lesson_ids: [] },
        ],
      });
    });
  });

  it("ignores a drop without a drag", async () => {
    const { requests } = renderTree();

    fireEvent.drop(screen.getByRole("link", { name: "Lesson a" }));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reorderBodyOf(requests)).toBeUndefined();
  });

  it("explains a stale tree", async () => {
    renderTree({ "POST /reorder": apiError("tree_out_of_date") });

    await userEvent.click(screen.getByRole("button", { name: "Move Lesson a down" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The course changed meanwhile. It was reloaded: try again.",
    );
  });

  it("adds a chapter at the end and a lesson to a chapter", async () => {
    const { requests } = renderTree({
      "POST /chapters": { status: 201, body: {} },
      "POST /lessons": { status: 201, body: {} },
    });

    await userEvent.type(screen.getByLabelText("New chapter title"), " Wrap-up ");
    await userEvent.click(screen.getByRole("button", { name: "Add a chapter" }));
    const practice = screen.getByRole("listitem", { name: "Practice" });
    await userEvent.type(within(practice).getByLabelText("New lesson title"), "Drill");
    await userEvent.selectOptions(within(practice).getByLabelText("Lesson type"), "video");
    await userEvent.click(within(practice).getByRole("button", { name: "Add a lesson" }));

    await waitFor(() => {
      expect(requests.find((r) => r.key === "POST /lessons")?.body).toEqual({
        chapter_id: "c2",
        title: "Drill",
        type: "video",
        position: 1,
      });
    });
    expect(requests.find((r) => r.key === "POST /chapters")?.body).toEqual({
      course_id: COURSE_ID,
      title: "Wrap-up",
      position: 2,
    });
  });

  it("publishes a draft chapter and deletes one after confirming", async () => {
    const { requests } = renderTree({
      "PATCH /chapters/c2": { body: {} },
      "DELETE /chapters/c2": { status: 204 },
    });
    const practice = screen.getByRole("listitem", { name: "Practice" });

    await userEvent.click(within(practice).getByRole("button", { name: "Publish" }));
    await userEvent.click(within(practice).getByRole("button", { name: "Delete: Practice" }));
    await userEvent.click(within(practice).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(requests.map((r) => r.key)).toContain("DELETE /chapters/c2");
    });
    expect(requests.find((r) => r.key === "PATCH /chapters/c2")?.body).toEqual({
      status: "published",
    });
  });

  it("cancels a deletion", async () => {
    const { requests } = renderTree();
    const basics = screen.getByRole("listitem", { name: "Basics" });

    await userEvent.click(within(basics).getByRole("button", { name: "Delete: Basics" }));
    await userEvent.click(within(basics).getByRole("button", { name: "Cancel" }));

    expect(within(basics).getByRole("button", { name: "Delete: Basics" })).toBeDefined();
    expect(requests.some((r) => r.key.startsWith("DELETE"))).toBe(false);
  });

  it("is read only for a shared course", () => {
    renderAdmin(<ContentTree course={{ ...tree, editable: false }} lessonHref={lessonHref} />, {});

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText("New chapter title")).toBeNull();
  });

  it("explains an empty course", () => {
    renderAdmin(<ContentTree course={{ ...tree, chapters: [] }} lessonHref={lessonHref} />, {});

    expect(screen.getByText("No chapter yet.")).toBeDefined();
  });
});

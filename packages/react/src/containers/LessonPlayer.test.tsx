import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ApiLesson } from "@bebranded/elearning-core";

import { enrolledSummary, lesson } from "../../tests/fixtures.js";
import { a11yViolations, renderWithProvider } from "../../tests/render.js";
import { LessonPlayer } from "./LessonPlayer.js";

const path = `/lessons/${lesson.id}`;
const progress = (status: string) => ({ body: { status, enrollment: enrolledSummary.enrollment } });

describe("LessonPlayer", () => {
  it("renders the server's HTML and records the opening once", async () => {
    const { calls } = renderWithProvider(<LessonPlayer lessonId={lesson.id} />, {
      [`GET ${path}`]: { body: lesson },
      [`POST ${path}/start`]: progress("in_progress"),
    });

    expect(await screen.findByRole("heading", { level: 2, name: "Hello" })).toBeDefined();
    expect(screen.getByText("this").tagName).toBe("STRONG");
    await waitFor(() => {
      expect(calls).toContain(`POST ${path}/start`);
    });
    expect(calls.filter((call) => call === `POST ${path}/start`)).toHaveLength(1);
  });

  it("marks a text lesson as done and shows it", async () => {
    let completed = false;
    const { calls } = renderWithProvider(<LessonPlayer lessonId={lesson.id} />, {
      [`GET ${path}`]: () => ({
        body: { ...lesson, status: completed ? "completed" : "in_progress" },
      }),
      [`POST ${path}/start`]: progress("in_progress"),
      [`POST ${path}/complete`]: () => {
        completed = true;
        return progress("completed");
      },
    });

    await userEvent.click(await screen.findByRole("button", { name: "Mark as done" }));

    expect((await screen.findByRole("status")).textContent).toBe("Lesson done");
    expect(screen.queryByRole("button", { name: "Mark as done" })).toBeNull();
    expect(calls).toContain(`POST ${path}/complete`);
  });

  it("explains that video and quiz lessons cannot be marked as done by hand", async () => {
    const video: ApiLesson = { ...lesson, type: "video" };
    renderWithProvider(<LessonPlayer lessonId={lesson.id} />, {
      [`GET ${path}`]: { body: video },
      [`POST ${path}/start`]: progress("in_progress"),
    });

    expect(
      await screen.findByText("This lesson is completed by watching or passing it."),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Mark as done" })).toBeNull();
  });

  it("does not record an opening for a lesson that failed to load", async () => {
    const { calls } = renderWithProvider(<LessonPlayer lessonId={lesson.id} />, {});

    await screen.findByRole("alert");
    expect(calls.some((call) => call.endsWith("/start"))).toBe(false);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(<LessonPlayer lessonId={lesson.id} />, {
      [`GET ${path}`]: { body: lesson },
      [`POST ${path}/start`]: progress("in_progress"),
    });
    await screen.findByRole("heading", { level: 1 });

    expect(await a11yViolations(container)).toEqual([]);
  });
});

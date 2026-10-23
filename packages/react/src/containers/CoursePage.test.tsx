import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ApiCourse } from "@bebranded/elearning-core";

import { course, enrolledSummary } from "../../tests/fixtures.js";
import { a11yViolations, renderWithProvider } from "../../tests/render.js";
import { CoursePage } from "./CoursePage.js";

const lessonHref = (lesson: { id: string }) => `/training/safety/${lesson.id}`;

describe("CoursePage", () => {
  it("shows the course, its progress and its lessons with statuses", async () => {
    renderWithProvider(<CoursePage slug="safety" lessonHref={lessonHref} />, {
      "GET /courses/safety": { body: course },
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Safety basics" })).toBeDefined();
    expect(screen.getByText("1 of 2 required lessons done")).toBeDefined();
    expect(screen.getByRole("link", { name: "Welcome" }).getAttribute("href")).toBe(
      `/training/safety/${course.chapters[0]?.lessons[0]?.id ?? ""}`,
    );
    expect(screen.getByText("Done")).toBeDefined();
    expect(screen.getByText("Optional")).toBeDefined();
    expect(screen.getByText("5 min")).toBeDefined();
  });

  it("enrolls in a self-enroll course and refreshes the page", async () => {
    let enrolled = false;
    const { calls } = renderWithProvider(<CoursePage slug="safety" lessonHref={lessonHref} />, {
      "GET /courses/safety": () => ({
        body: enrolled ? { ...course, enrollment: enrolledSummary.enrollment } : course,
      }),
      "POST /courses/00000000-0000-4000-8000-000000000001/enroll": () => {
        enrolled = true;
        return { status: 201, body: enrolledSummary.enrollment };
      },
    });

    await userEvent.click(await screen.findByRole("button", { name: "Enroll" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Enroll" })).toBeNull();
    });
    expect(calls.filter((call) => call === "GET /courses/safety")).toHaveLength(2);
  });

  it("offers no enrollment for assignment-only courses or when already enrolled", async () => {
    const assigned: ApiCourse = { ...course, enrollment_mode: "assignment_only" };
    renderWithProvider(<CoursePage slug="safety" lessonHref={lessonHref} />, {
      "GET /courses/safety": { body: assigned },
    });

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Enroll" })).toBeNull();
  });

  it("says when the course is completed", async () => {
    const done: ApiCourse = {
      ...course,
      progress: { completed_required: 2, total_required: 2, ratio: 1, is_complete: true },
    };
    renderWithProvider(<CoursePage slug="safety" lessonHref={lessonHref} />, {
      "GET /courses/safety": { body: done },
    });

    expect(await screen.findByText("Course completed")).toBeDefined();
  });

  it("shows a not-found message for a hidden or missing course", async () => {
    renderWithProvider(<CoursePage slug="secret" lessonHref={lessonHref} />, {});

    expect((await screen.findByRole("alert")).textContent).toContain(
      "does not exist or is not available",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(<CoursePage slug="safety" lessonHref={lessonHref} />, {
      "GET /courses/safety": { body: course },
    });
    await screen.findByRole("heading", { level: 1 });

    expect(await a11yViolations(container)).toEqual([]);
  });
});

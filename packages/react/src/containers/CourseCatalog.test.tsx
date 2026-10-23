import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { a11yViolations, renderWithProvider } from "../../tests/render.js";
import { courseSummary, enrolledSummary } from "../../tests/fixtures.js";
import { CourseCatalog } from "./CourseCatalog.js";
import { MyTraining } from "./MyTraining.js";

const href = (course: { slug: string }) => `/training/${course.slug}`;

describe("CourseCatalog", () => {
  it("shows a loading state, then the visible courses as links", async () => {
    renderWithProvider(<CourseCatalog courseHref={href} />, {
      "GET /courses": { body: { data: [courseSummary, enrolledSummary], next_cursor: null } },
    });

    expect(screen.getByRole("status").textContent).toContain("Loading…");
    expect((await screen.findByRole("link", { name: "Safety basics" })).getAttribute("href")).toBe(
      "/training/safety",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Training" })).toBeDefined();
  });

  it("shows progress and due date only for enrolled courses", async () => {
    renderWithProvider(<CourseCatalog courseHref={href} />, {
      "GET /courses": { body: { data: [courseSummary, enrolledSummary], next_cursor: null } },
    });

    expect(
      (await screen.findByRole("progressbar", { name: "Progress: First aid" })).getAttribute(
        "value",
      ),
    ).toBe("0.5");
    expect(screen.queryByRole("progressbar", { name: "Progress: Safety basics" })).toBeNull();
    expect(screen.getByText("Due Dec 31, 2026")).toBeDefined();
  });

  it("shows an empty message when no course is available", async () => {
    renderWithProvider(<CourseCatalog courseHref={href} />, {
      "GET /courses": { body: { data: [], next_cursor: null } },
    });

    expect(await screen.findByText("No course is available to you yet.")).toBeDefined();
  });

  it("asks to sign in on 401 and offers a retry on server errors", async () => {
    const unauthenticated = renderWithProvider(<CourseCatalog courseHref={href} />, {
      "GET /courses": {
        status: 401,
        body: { error: { code: "unauthenticated", message: "Sign in", request_id: "r" } },
      },
    });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Sign in to see your training.",
    );
    unauthenticated.unmount();

    renderWithProvider(<CourseCatalog courseHref={href} />, {
      "GET /courses": { status: 500, body: "<html>proxy error</html>" },
    });
    // A 500 is retried once (after about 1 s) before the error state shows.
    expect(
      await screen.findByRole("button", { name: "Try again" }, { timeout: 3000 }),
    ).toBeDefined();
  });

  it("speaks French when the locale is fr", async () => {
    renderWithProvider(
      <CourseCatalog courseHref={href} />,
      { "GET /courses": { body: { data: [], next_cursor: null } } },
      { locale: "fr" },
    );

    expect(await screen.findByText("Aucune formation ne vous est encore proposée.")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Formations" })).toBeDefined();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(<CourseCatalog courseHref={href} />, {
      "GET /courses": { body: { data: [courseSummary, enrolledSummary], next_cursor: null } },
    });
    await screen.findByRole("link", { name: "First aid" });

    expect(await a11yViolations(container)).toEqual([]);
  });
});

describe("MyTraining", () => {
  it("lists the learner's enrollments", async () => {
    renderWithProvider(<MyTraining courseHref={href} />, {
      "GET /me/progress": { body: { data: [enrolledSummary], next_cursor: null } },
    });

    expect(await screen.findByRole("heading", { name: "My training" })).toBeDefined();
    expect(screen.getByRole("link", { name: "First aid" })).toBeDefined();
  });

  it("shows its empty and error states", async () => {
    const empty = renderWithProvider(<MyTraining courseHref={href} />, {
      "GET /me/progress": { body: { data: [], next_cursor: null } },
    });
    expect(await screen.findByText("You are not enrolled in any course.")).toBeDefined();
    empty.unmount();

    renderWithProvider(<MyTraining courseHref={href} />, {
      "GET /me/progress": {
        status: 404,
        body: { error: { code: "not_found", message: "x", request_id: "r" } },
      },
    });
    expect((await screen.findByRole("alert", undefined)).textContent).toContain(
      "This content does not exist",
    );
  });
});

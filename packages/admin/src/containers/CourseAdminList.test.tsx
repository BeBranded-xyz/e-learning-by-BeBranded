import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { course } from "../../tests/fixtures.js";
import { a11yViolations, apiError, renderAdmin } from "../../tests/render.js";
import { CourseAdminList } from "./CourseAdminList.js";

const href = (entry: { id: string }) => `/admin/courses/${entry.id}`;
const shared = {
  ...course,
  id: "shared-1",
  title: "Shared onboarding",
  editable: false,
  status: "published" as const,
};

describe("CourseAdminList", () => {
  it("lists courses with their status, marks shared ones, and has no a11y violation", async () => {
    const { container } = renderAdmin(<CourseAdminList courseHref={href} />, {
      "GET /courses": { body: { data: [course, shared], next_cursor: null } },
    });

    expect(screen.getByRole("status").textContent).toContain("Loading");
    const link = await screen.findByRole("link", { name: "Edit Safety basics" });
    expect(link.getAttribute("href")).toBe(`/admin/courses/${course.id}`);
    expect(screen.getByText("Draft")).toBeDefined();
    expect(screen.getByText("Shared catalog (read only)")).toBeDefined();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("shows an empty state", async () => {
    renderAdmin(<CourseAdminList courseHref={href} />, {
      "GET /courses": { body: { data: [], next_cursor: null } },
    });

    expect(await screen.findByText("No course yet. Create the first one.")).toBeDefined();
  });

  it("shows an error with a retry", async () => {
    let fail = true;
    renderAdmin(<CourseAdminList courseHref={href} />, {
      "GET /courses": () =>
        fail ? apiError("internal_error", 500) : { body: { data: [course], next_cursor: null } },
    });

    const retry = await screen.findByRole("button", { name: "Try again" }, { timeout: 3000 });
    fail = false;
    await userEvent.click(retry);

    expect(await screen.findByRole("link", { name: "Edit Safety basics" })).toBeDefined();
  });

  it("creates a course with a slug suggested from the title", async () => {
    const onCreated = vi.fn();
    const { requests } = renderAdmin(<CourseAdminList courseHref={href} onCreated={onCreated} />, {
      "GET /courses": { body: { data: [], next_cursor: null } },
      "POST /courses": { status: 201, body: course },
    });

    await userEvent.type(await screen.findByLabelText("Title"), "Sécurité au travail");
    expect(screen.getByLabelText<HTMLInputElement>("URL slug").value).toBe("securite-au-travail");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(course);
    });
    expect(requests.find((r) => r.key === "POST /courses")?.body).toEqual({
      title: "Sécurité au travail",
      slug: "securite-au-travail",
      locale: "en",
    });
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("");
  });

  it("keeps an edited slug and shows a taken slug as a message", async () => {
    const { requests } = renderAdmin(<CourseAdminList courseHref={href} />, {
      "GET /courses": { body: { data: [], next_cursor: null } },
      "POST /courses": apiError("slug_taken"),
    });

    await userEvent.type(await screen.findByLabelText("Title"), "Intro");
    const slug = screen.getByLabelText("URL slug");
    await userEvent.clear(slug);
    await userEvent.type(slug, "custom-intro");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Another course already uses this URL slug.",
    );
    expect(requests.find((r) => r.key === "POST /courses")?.body).toMatchObject({
      slug: "custom-intro",
    });
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Intro");
  });

  it("speaks French", async () => {
    renderAdmin(
      <CourseAdminList courseHref={href} />,
      { "GET /courses": { body: { data: [], next_cursor: null } } },
      "fr",
    );

    expect(await screen.findByRole("heading", { name: "Formations" })).toBeDefined();
  });
});

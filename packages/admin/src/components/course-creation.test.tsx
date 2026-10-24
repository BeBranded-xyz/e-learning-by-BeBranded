import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { course } from "../../tests/fixtures.js";
import { renderAdmin, a11yViolations } from "../../tests/render.js";
import { CourseCreateForm } from "./CourseCreateForm.js";
import { CourseAdminList } from "../containers/CourseAdminList.js";
import { LanguageField } from "./LanguageField.js";

it("uses a creation route instead of embedding a second form when configured", async () => {
  renderAdmin(<CourseAdminList courseHref={() => "/course"} createHref="/courses/new" />, {
    "GET /courses": { body: { data: [course] } },
  });
  const link = await screen.findByRole("link", { name: /Create a course/ });
  expect(link.getAttribute("href")).toBe("/courses/new");
  expect(screen.queryByRole("form", { name: "New course" })).toBeNull();
});

it("creates a draft with the initial course settings and language", async () => {
  const onCreated = vi.fn();
  const { requests, container } = renderAdmin(
    <CourseCreateForm showSettings onCreated={onCreated} />,
    {
      "POST /courses": { status: 201, body: course },
    },
  );
  await userEvent.type(screen.getByLabelText("Title"), "Introduction");
  await userEvent.type(screen.getByLabelText("Summary"), " A useful overview ");
  await userEvent.selectOptions(screen.getByLabelText("Language"), "es");
  await userEvent.selectOptions(screen.getByLabelText("Who can enroll"), "assignment_only");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(requests.find((request) => request.key === "POST /courses")?.body).toEqual({
    title: "Introduction",
    slug: "introduction",
    summary: "A useful overview",
    locale: "es",
    enrollment_mode: "assignment_only",
  });
  expect(onCreated).toHaveBeenCalledWith(course);
  expect(await a11yViolations(container)).toEqual([]);
});

it("keeps a shared course's regional language visible and disabled", () => {
  renderAdmin(<LanguageField value="fr-CA" disabled onChange={vi.fn()} />, {});
  const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Language" });
  expect(select.disabled).toBe(true);
  expect(select.value).toBe("fr-CA");
});

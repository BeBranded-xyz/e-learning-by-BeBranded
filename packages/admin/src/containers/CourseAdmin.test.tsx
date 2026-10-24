import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { COURSE_ID, tree } from "../../tests/fixtures.js";
import { a11yViolations, apiError, renderAdmin } from "../../tests/render.js";
import { CourseAdmin } from "./CourseAdmin.js";

const lessonHref = (lesson: { id: string }) => `/admin/lessons/${lesson.id}`;
const courseReport = {
  course: { id: COURSE_ID, slug: "safety-basics", title: "Safety basics", status: "draft" },
  summary: { enrolled: 0, started: 0, completed: 0, overdue: 0, average_progress: null },
  data: [],
  next_cursor: null,
};
const assignment = {
  id: "as-1",
  course_id: COURSE_ID,
  audience: { type: "role", role: "sales" },
  due_at: "2026-12-31T23:59:59.000Z",
  assigned_by: "admin-1",
  created_at: "2026-10-24T09:00:00.000Z",
};

function renderCourse(api = {}, onDeleted = vi.fn()) {
  const rendered = renderAdmin(
    <CourseAdmin
      courseId={COURSE_ID}
      lessonHref={lessonHref}
      roles={["sales", "staff"]}
      onDeleted={onDeleted}
    />,
    {
      [`GET /courses/${COURSE_ID}`]: { body: tree },
      [`GET /courses/${COURSE_ID}/assignments`]: {
        body: { data: [assignment], next_cursor: null },
      },
      [`GET /reports/courses/${COURSE_ID}`]: { body: courseReport },
      ...api,
    },
  );
  return { ...rendered, onDeleted };
}

const bodyOf = (requests: { key: string; body: unknown }[], key: string) =>
  requests.find((request) => request.key === key)?.body;

describe("CourseAdmin", () => {
  it("shows the course, its content, rules, assignments and tracking without a11y violation", async () => {
    const { container } = renderCourse();

    expect(await screen.findByText("Nobody is enrolled yet.")).toBeDefined();

    expect(await screen.findByRole("heading", { level: 2, name: "Safety basics" })).toBeDefined();
    expect(screen.getByText("Allow: Everyone")).toBeDefined();
    expect(await screen.findByText("Role sales")).toBeDefined();
    expect(screen.getByText("Due Dec 31, 2026")).toBeDefined();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("offers the course download only when the server can export", async () => {
    renderAdmin(<CourseAdmin courseId={COURSE_ID} lessonHref={lessonHref} />, {
      [`GET /courses/${COURSE_ID}`]: { body: { ...tree, export_formats: ["pdf", "docx"] } },
    });

    const group = await screen.findByRole("group", { name: "Download the course" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Download PDF", "Download Word (.docx)"]);
  });

  it("hides the course download without an exporter", async () => {
    renderAdmin(<CourseAdmin courseId={COURSE_ID} lessonHref={lessonHref} />, {
      [`GET /courses/${COURSE_ID}`]: { body: tree },
    });

    expect(await screen.findByRole("form", { name: "Safety basics" })).toBeDefined();
    expect(screen.queryByRole("group", { name: "Download the course" })).toBeNull();
  });

  it("shows a not found message for an unknown course", async () => {
    renderAdmin(<CourseAdmin courseId="nope" lessonHref={lessonHref} />, {});

    expect(await screen.findByText(/does not exist/)).toBeDefined();
  });

  it("saves edited settings with an empty summary as null", async () => {
    const { requests } = renderCourse({ [`PATCH /courses/${COURSE_ID}`]: { body: tree } });

    const title = await screen.findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Safety 2026 ");
    await userEvent.selectOptions(screen.getByLabelText("Language"), "fr");
    await userEvent.selectOptions(screen.getByLabelText("Who can enroll"), "assignment_only");
    await userEvent.click(screen.getByRole("checkbox", { name: /Learners can download/ }));
    await userEvent.click(
      within(screen.getByRole("form", { name: "Safety basics" })).getByRole("button", {
        name: "Save",
      }),
    );

    expect(await screen.findByText("Saved")).toBeDefined();
    expect(bodyOf(requests, `PATCH /courses/${COURSE_ID}`)).toEqual({
      title: "Safety 2026",
      locale: "fr",
      slug: "safety-basics",
      summary: null,
      enrollment_mode: "assignment_only",
      allow_learner_export: true,
    });
  });

  it("publishes, and shows a refusal as a message", async () => {
    const { requests } = renderCourse({
      [`PATCH /courses/${COURSE_ID}`]: apiError("validation_failed", 400),
    });

    const settings = within(await screen.findByRole("form", { name: "Safety basics" }));
    await userEvent.click(settings.getByRole("button", { name: "Publish" }));

    expect((await settings.findByRole("alert")).textContent).toBe("Some fields are invalid.");
    expect(bodyOf(requests, `PATCH /courses/${COURSE_ID}`)).toEqual({ status: "published" });
  });

  it("deletes the course after confirming", async () => {
    const { onDeleted } = renderCourse({ [`DELETE /courses/${COURSE_ID}`]: { status: 204 } });

    await userEvent.click(await screen.findByRole("button", { name: "Delete: Safety basics" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });
  });

  it("adds and removes access rules", async () => {
    const { requests } = renderCourse({
      "POST /access-rules": { status: 201, body: {} },
      "DELETE /access-rules/rule-1": { status: 204 },
    });
    const rules = within(await screen.findByRole("region", { name: "Who can see it" }));

    await userEvent.selectOptions(rules.getByLabelText("Effect"), "deny");
    await userEvent.selectOptions(rules.getByLabelText("Audience"), "role");
    await userEvent.type(rules.getByLabelText("Role"), "contractor");
    await userEvent.click(rules.getByRole("button", { name: "Add a rule" }));
    await userEvent.click(rules.getByRole("button", { name: "Remove the rule Allow: Everyone" }));

    await waitFor(() => {
      expect(requests.map((r) => r.key)).toContain("DELETE /access-rules/rule-1");
    });
    expect(bodyOf(requests, "POST /access-rules")).toEqual({
      target_type: "course",
      target_id: COURSE_ID,
      effect: "deny",
      audience: { type: "role", role: "contractor" },
    });
  });

  it("does not submit an audience without a valid value", async () => {
    renderCourse();
    const rules = within(await screen.findByRole("region", { name: "Who can see it" }));

    await userEvent.selectOptions(rules.getByLabelText("Audience"), "grade_min");
    await userEvent.type(rules.getByLabelText("Minimum grade"), "two");

    expect(rules.getByRole<HTMLButtonElement>("button", { name: "Add a rule" }).disabled).toBe(
      true,
    );
  });

  it("assigns a learner with a due date, and explains an audience without access", async () => {
    const { requests } = renderCourse({ "POST /assignments": apiError("audience_without_access") });
    const section = within(await screen.findByRole("region", { name: "Assignments" }));

    await userEvent.selectOptions(section.getByLabelText("Audience"), "learner");
    await userEvent.type(section.getByLabelText("Learner id"), "staff-1");
    await userEvent.type(section.getByLabelText("Due date"), "2026-11-30");
    await userEvent.click(section.getByRole("button", { name: "Assign" }));

    expect((await section.findByRole("alert")).textContent).toBe(
      "The access rules of this course do not let this audience see it.",
    );
    expect(bodyOf(requests, "POST /assignments")).toEqual({
      course_id: COURSE_ID,
      audience: { type: "learner", learner_id: "staff-1" },
      due_at: "2026-11-30T23:59:59.000Z",
    });
  });

  it("assigns a grade without due date and removes an assignment", async () => {
    const { requests } = renderCourse({
      "POST /assignments": { status: 201, body: assignment },
      "DELETE /assignments/as-1": { status: 204 },
    });
    const section = within(await screen.findByRole("region", { name: "Assignments" }));

    await userEvent.selectOptions(section.getByLabelText("Audience"), "grade_min");
    await userEvent.type(section.getByLabelText("Minimum grade"), "3");
    await userEvent.click(section.getByRole("button", { name: "Assign" }));
    await userEvent.click(
      await section.findByRole("button", { name: "Remove the assignment Role sales" }),
    );

    await waitFor(() => {
      expect(requests.map((r) => r.key)).toContain("DELETE /assignments/as-1");
    });
    expect(bodyOf(requests, "POST /assignments")).toEqual({
      course_id: COURSE_ID,
      audience: { type: "grade_min", grade: 3 },
      due_at: null,
    });
  });

  it("suggests the host's roles", async () => {
    renderCourse();
    const rules = within(await screen.findByRole("region", { name: "Who can see it" }));

    await userEvent.selectOptions(rules.getByLabelText("Audience"), "role");

    expect(rules.getByLabelText("Role").getAttribute("list")).not.toBeNull();
    const list = rules.getByLabelText("Role").getAttribute("list") ?? "";
    expect(document.getElementById(list)?.querySelectorAll("option")).toHaveLength(2);
  });

  it("reloads the course after a refused reorder", async () => {
    const { requests } = renderCourse({ "POST /reorder": apiError("tree_out_of_date") });

    await userEvent.click(await screen.findByRole("button", { name: "Move Lesson a down" }));

    await screen.findByText("The course changed meanwhile. It was reloaded: try again.");
    await waitFor(() => {
      expect(requests.filter((r) => r.key === `GET /courses/${COURSE_ID}`)).toHaveLength(2);
    });
  });

  it("shows a shared course read only", async () => {
    renderCourse({ [`GET /courses/${COURSE_ID}`]: { body: { ...tree, editable: false } } });

    expect(await screen.findByRole("heading", { level: 2, name: "Safety basics" })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>("Title").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a rule" })).toBeNull();
  });
});

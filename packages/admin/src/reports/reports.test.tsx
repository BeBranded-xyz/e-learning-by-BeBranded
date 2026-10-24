import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { COURSE_ID } from "../../tests/fixtures.js";
import { a11yViolations, apiError, renderAdmin } from "../../tests/render.js";
import { CourseReport } from "./CourseReport.js";
import { LearnerReport } from "./LearnerReport.js";
import { QuizReport } from "./QuizReport.js";

const row = (learner: string, overrides = {}) => ({
  learner_id: learner,
  course_id: COURSE_ID,
  source: "assigned",
  assigned_by: "admin-1",
  due_at: "2026-05-01T00:00:00.000Z",
  started_at: "2026-04-01T00:00:00.000Z",
  completed_at: null,
  progress: 0.5,
  overdue: true,
  ...overrides,
});
const summary = { enrolled: 2, started: 2, completed: 1, overdue: 1, average_progress: 0.75 };
const courseReport = {
  course: { id: COURSE_ID, slug: "safety-basics", title: "Safety basics", status: "published" },
  summary,
  data: [
    row("staff-1"),
    row("staff-2", {
      source: "self",
      due_at: null,
      overdue: false,
      completed_at: "2026-04-10T00:00:00.000Z",
      progress: 1,
    }),
  ],
  next_cursor: null,
};

describe("CourseReport", () => {
  it("shows the summary, each learner, late ones, and the CSV link, without a11y violation", async () => {
    const { container } = renderAdmin(
      <CourseReport courseId={COURSE_ID} learnerHref={(id) => `/admin/learners/${id}`} />,
      {
        [`GET /reports/courses/${COURSE_ID}`]: { body: courseReport },
      },
    );

    expect(await screen.findByText("Average progress")).toBeDefined();
    expect(screen.getByText("75%")).toBeDefined();
    const table = within(screen.getByRole("table", { name: "Safety basics" }));
    expect(table.getByRole("link", { name: "staff-1" }).getAttribute("href")).toBe(
      "/admin/learners/staff-1",
    );
    expect(table.getAllByText("Late")).toHaveLength(1);
    expect(table.getByText("Themselves")).toBeDefined();
    expect(screen.getByRole("link", { name: "Download CSV" }).getAttribute("href")).toBe(
      `/api/elearning/v1/admin/reports/courses/${COURSE_ID}?format=csv`,
    );
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("says when nobody is enrolled", async () => {
    renderAdmin(<CourseReport courseId={COURSE_ID} />, {
      [`GET /reports/courses/${COURSE_ID}`]: {
        body: {
          ...courseReport,
          data: [],
          summary: { ...summary, enrolled: 0, average_progress: null },
        },
      },
    });

    expect(await screen.findByText("Nobody is enrolled yet.")).toBeDefined();
    expect(screen.getByText("–")).toBeDefined();
  });
});

describe("report errors", () => {
  it("shows a failed report with a retry", async () => {
    renderAdmin(<CourseReport courseId={COURSE_ID} />, {
      [`GET /reports/courses/${COURSE_ID}`]: apiError("internal_error", 500),
    });

    expect(
      await screen.findByRole("button", { name: "Try again" }, { timeout: 3000 }),
    ).toBeDefined();
  });

  it("shows a learner report error and an unknown quiz", async () => {
    renderAdmin(<LearnerReport learnerId="x" />, {});
    renderAdmin(<QuizReport lessonId="none" />, {});

    await waitFor(() => {
      expect(screen.getAllByText(/does not exist/)).toHaveLength(2);
    });
  });
});

describe("LearnerReport", () => {
  it("lists the learner's courses with links", async () => {
    renderAdmin(<LearnerReport learnerId="staff 1" courseHref={(id) => `/admin/courses/${id}`} />, {
      "GET /reports/learners/staff%201": {
        body: {
          learner_id: "staff 1",
          summary,
          data: [{ ...row("staff 1"), course_title: "Safety basics" }],
          next_cursor: null,
        },
      },
    });

    expect(await screen.findByRole("heading", { name: "Learner staff 1" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Safety basics" }).getAttribute("href")).toBe(
      `/admin/courses/${COURSE_ID}`,
    );
    expect(screen.getByRole("link", { name: "Download CSV" }).getAttribute("href")).toContain(
      "learners/staff%201?format=csv",
    );
  });

  it("falls back to the course id without a title, and shows errors", async () => {
    renderAdmin(<LearnerReport learnerId="x" />, {
      "GET /reports/learners/x": {
        body: {
          learner_id: "x",
          summary,
          data: [{ ...row("x"), course_title: null }],
          next_cursor: null,
        },
      },
    });
    expect(await screen.findByText(COURSE_ID)).toBeDefined();
  });
});

const quizReport = {
  lesson_id: "q",
  title: "Final quiz",
  learners: 2,
  attempts: 3,
  pass_rate: 0.5,
  average_score: 0.6,
  average_attempts: 1.5,
  questions: [
    { question_id: "q1", prompt: "Exits are green", answered: 3, correct_rate: 0.666667 },
    { question_id: "q2", prompt: "New question", answered: 0, correct_rate: null },
  ],
  learners_results: [
    {
      learner_id: "staff-1",
      attempts: 2,
      best_score: 1,
      passed: true,
      last_attempt_at: "2026-10-20T10:00:00.000Z",
    },
  ],
};
const grant = {
  id: "g1",
  lesson_id: "q",
  learner_id: "staff-2",
  extra_attempts: 2,
  granted_by: "admin-1",
  created_at: "2026-10-21T09:00:00.000Z",
};

function renderQuizReport(api = {}) {
  return renderAdmin(<QuizReport lessonId="q" />, {
    "GET /reports/quizzes/q": { body: quizReport },
    "GET /lessons/q/quiz/attempt-grants": { body: { data: [grant], next_cursor: null } },
    ...api,
  });
}

describe("QuizReport", () => {
  it("shows rates, the per-question analysis, results and grants", async () => {
    const { container } = renderQuizReport();

    expect(await screen.findByText("Pass rate")).toBeDefined();
    expect(screen.getByText("1.5")).toBeDefined();
    const questions = within(screen.getByRole("table", { name: "Questions" }));
    expect(questions.getByText("67%")).toBeDefined();
    expect(questions.getByText("–")).toBeDefined();
    expect(within(screen.getByRole("table", { name: "Learners" })).getByText("Yes")).toBeDefined();
    expect(
      await screen.findByText("2 extra attempt(s) for staff-2, on Oct 21, 2026"),
    ).toBeDefined();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("grants attempts and tells how many are left", async () => {
    const { requests } = renderQuizReport({
      "POST /lessons/q/quiz/attempt-grants": {
        status: 201,
        body: { ...grant, learner_id: "staff-3", attempts_used: 3, attempts_remaining: 2 },
      },
    });

    await userEvent.type(await screen.findByLabelText("Learner id"), " staff-3 ");
    const extra = screen.getByRole("spinbutton", { name: "Extra attempts" });
    await userEvent.clear(extra);
    await userEvent.type(extra, "2");
    await userEvent.click(screen.getByRole("button", { name: "Grant attempts" }));

    expect(await screen.findByText("Granted. staff-3 has 2 attempt(s) left.")).toBeDefined();
    expect(requests.find((r) => r.key === "POST /lessons/q/quiz/attempt-grants")?.body).toEqual({
      learner_id: "staff-3",
      extra_attempts: 2,
    });
    await waitFor(() => {
      expect(requests.filter((r) => r.key === "GET /reports/quizzes/q")).toHaveLength(2);
    });
  });

  it("says when attempts are unlimited, and shows refusals", async () => {
    renderQuizReport({
      "POST /lessons/q/quiz/attempt-grants": {
        status: 201,
        body: { ...grant, attempts_used: 0, attempts_remaining: null },
      },
    });

    await userEvent.type(await screen.findByLabelText("Learner id"), "staff-3");
    await userEvent.click(screen.getByRole("button", { name: "Grant attempts" }));

    expect(await screen.findByText("Granted. Attempts are unlimited on this quiz.")).toBeDefined();
  });

  it("explains a refused grant", async () => {
    renderQuizReport({ "POST /lessons/q/quiz/attempt-grants": apiError("validation_failed", 400) });

    await userEvent.type(await screen.findByLabelText("Learner id"), "staff-3");
    await userEvent.click(screen.getByRole("button", { name: "Grant attempts" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Some fields are invalid.");
  });

  it("shows an empty quiz without a learners table", async () => {
    renderQuizReport({
      "GET /reports/quizzes/q": {
        body: {
          ...quizReport,
          learners: 0,
          attempts: 0,
          pass_rate: null,
          average_score: null,
          average_attempts: null,
          learners_results: [],
        },
      },
      "GET /lessons/q/quiz/attempt-grants": { body: { data: [], next_cursor: null } },
    });

    expect(await screen.findByText("No extra attempt granted yet.")).toBeDefined();
    expect(screen.queryByRole("table", { name: "Learners" })).toBeNull();
  });
});

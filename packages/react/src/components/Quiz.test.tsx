import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { quizAttempt, quizLesson, quizResult, quizStanding } from "../../tests/fixtures.js";
import { a11yViolations, renderWithProvider } from "../../tests/render.js";
import type { FakeApi } from "../../tests/render.js";
import { LessonView } from "./LessonView.js";

const path = `/lessons/${quizLesson.id}`;
const openKey = `POST ${path}/quiz/attempts`;
const submitKey = `POST ${path}/quiz/attempts/${quizAttempt.id}/submit`;

function renderQuiz(api: FakeApi = {}, quiz = quizStanding) {
  return renderWithProvider(<LessonView lesson={{ ...quizLesson, quiz }} />, {
    [`GET ${path}`]: { body: { ...quizLesson, quiz } },
    [openKey]: { status: 201, body: quizAttempt },
    [submitKey]: { body: quizResult },
    ...api,
  });
}

const error = (status: number, code: string, details?: unknown) => ({
  status,
  body: { error: { code, message: code, request_id: "req_test", details } },
});

async function startAndAnswer(beforeAnswering: () => void = () => undefined) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Start the quiz" }));
  const green = await screen.findByRole("radio", { name: "Green" });
  beforeAnswering();
  await user.click(screen.getByRole("radio", { name: "True" }));
  await user.click(green);
  await user.click(screen.getByRole("button", { name: "Submit my answers" }));
}

// SurveyJS renders its full form in jsdom, which takes seconds under coverage instrumentation.
describe("Quiz", { timeout: 20_000 }, () => {
  it("states the rules before the first attempt, accessibly", async () => {
    const { container } = renderQuiz();

    expect(screen.getByText("Pass with 80% or more.")).toBeDefined();
    expect(screen.getByText("3 of 3 attempts left.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Start the quiz" })).toBeDefined();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("renders the attempt with SurveyJS and sends the raw answers", async () => {
    const { requests } = renderQuiz();

    await startAndAnswer(() => {
      // Context blocks arrive as server-rendered HTML elements of the survey.
      expect(screen.getByText("Look at the poster.")).toBeDefined();
      expect(screen.getByRole("radiogroup", { name: /Which color marks an exit/ })).toBeDefined();
    });

    await screen.findByText("Not passed: 50%");
    expect(requests.find((request) => request.key === submitKey)?.body).toEqual({
      answers: { q1: true, q2: "o2" },
    });
  });

  it("shows the result and the corrections in words", async () => {
    renderQuiz();

    await startAndAnswer();

    expect(await screen.findByText("1 of 2 points")).toBeDefined();
    expect(screen.getByText("Incorrect · Answer: Green")).toBeDefined();
    expect(screen.getByText("Correct · Answer: True")).toBeDefined();
    expect(screen.getByText("Green means safe.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("offers no retry once the attempts are used up", async () => {
    renderQuiz({
      [submitKey]: { body: { ...quizResult, attempts_remaining: 0, corrections: null } },
    });

    await startAndAnswer();

    await screen.findByText("Not passed: 50%");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByText("Corrections")).toBeNull();
  });

  it("explains a cooldown or used-up attempts instead of the start button", () => {
    renderQuiz({}, { ...quizStanding, attempts_remaining: 0 });

    expect(screen.getByText("You have used every attempt at this quiz.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Start the quiz" })).toBeNull();
  });

  it("explains why an attempt could not open", async () => {
    renderQuiz({
      [openKey]: error(429, "cooldown", { next_attempt_at: "2026-10-23T10:00:00.000Z" }),
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Start the quiz" }));

    expect(await screen.findByText(/Your next attempt opens on/)).toBeDefined();
  });

  it("asks for a new attempt when the quiz changed meanwhile", async () => {
    renderQuiz({ [submitKey]: error(409, "quiz_changed") });

    await startAndAnswer();

    expect(
      await screen.findByText(
        "This quiz was edited while you were taking it. Start a new attempt.",
      ),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Start the quiz" })).toBeDefined();
  });

  it("offers to resume an open attempt, and says when a quiz has no questions", () => {
    const open = { id: quizAttempt.id, started_at: quizAttempt.started_at, expires_at: null };
    const { unmount } = renderQuiz({}, { ...quizStanding, open_attempt: open });

    expect(screen.getByRole("button", { name: "Resume the quiz" })).toBeDefined();
    unmount();
    renderQuiz({}, { ...quizStanding, ready: false });
    expect(screen.getByText("This quiz has no questions yet.")).toBeDefined();
  });

  it("shows the time left and submits when it runs out", async () => {
    const expiresAt = new Date(Date.now() + 1500).toISOString();
    const { requests } = renderQuiz({
      [openKey]: { status: 201, body: { ...quizAttempt, expires_at: expiresAt } },
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Start the quiz" }));

    expect(await screen.findByRole("timer")).toBeDefined();
    await waitFor(
      () => {
        expect(requests.some((request) => request.key === submitKey)).toBe(true);
      },
      { timeout: 4000 },
    );
  });

  it("shows a passed quiz and the best score", () => {
    renderQuiz({}, { ...quizStanding, passed: true, best_score: 1 });

    expect(screen.getByText("Quiz passed")).toBeDefined();
    expect(screen.getByText("Best score: 100%")).toBeDefined();
  });

  it("renders the SurveyJS form accessibly", async () => {
    const { container } = renderQuiz();

    await userEvent.setup().click(screen.getByRole("button", { name: "Start the quiz" }));
    await screen.findByRole("radio", { name: "Green" });

    expect(await a11yViolations(container)).toEqual([]);
  });

  it("shows option texts as text, never as HTML", async () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const attempt = structuredClone(quizAttempt);
    const element = attempt.survey.pages[0].elements[2];
    if (element?.type !== "radiogroup") throw new Error("fixture changed");
    const tampered = { ...element, choices: [{ value: "o1", text: hostile }, ...element.choices] };
    const survey = { pages: [{ name: "quiz" as const, elements: [tampered] }] as const };
    const { container } = renderQuiz({ [openKey]: { status: 201, body: { ...attempt, survey } } });

    await userEvent.setup().click(screen.getByRole("button", { name: "Start the quiz" }));

    expect(await screen.findByText(hostile)).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });
});

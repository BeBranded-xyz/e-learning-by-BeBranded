import type { Page } from "@playwright/test";

import { expect, expectAccessible, test } from "./fixtures";

const LESSON = "Fire safety quiz";
type Survey = {
  pages: [
    { elements: { type: string; name: string; choices?: { value: string; text: string }[] }[] },
  ];
};

async function openQuizLesson(page: Page): Promise<string> {
  await page.goto("/training/fire-safety-check");
  await page.getByRole("link", { name: LESSON }).click();
  await expect(page.getByRole("button", { name: "Start the quiz" })).toBeVisible();
  return page.url().split("/").at(-1) ?? "";
}

async function answer(page: Page, right: boolean) {
  await page.getByRole("button", { name: "Start the quiz" }).click();
  // SurveyJS styles its own inputs: learners click the labels.
  const pick = (label: string) => page.getByText(label, { exact: true }).click();
  await pick(right ? "Raise the alarm" : "Open the windows");
  await pick(right ? "False" : "True");
  await pick("Clear corridors");
  if (right) await pick("Lit exit signs");
  await page.getByRole("button", { name: "Submit my answers" }).click();
}

test.describe("quiz lesson", () => {
  test("passing the quiz completes the lesson and the course, with corrections", async ({
    page,
    signInAs,
  }) => {
    await signInAs("staff");
    await openQuizLesson(page);
    await expectAccessible(page);

    await answer(page, true);

    await expect(page.getByText("Passed: 100%")).toBeVisible();
    await expect(page.getByText("Corrections")).toBeVisible();
    await expect(page.getByText("Lifts can stop between floors.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Lesson done" })).toBeVisible();
    await page.getByRole("link", { name: "Back to the course", exact: true }).click();
    await expect(page.getByText("Course completed")).toBeVisible();
  });

  test("a failed attempt hides the corrections, and the attempts run out", async ({
    page,
    signInAs,
  }) => {
    await signInAs("staff");
    await openQuizLesson(page);

    await answer(page, false);
    await expect(page.getByText("Not passed: 0%")).toBeVisible();
    await expect(page.getByText("Corrections")).toBeHidden();
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByRole("button", { name: "Submit my answers" }).click();

    await expect(page.getByText("Not passed: 0%")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeHidden();
    await page.reload();
    await expect(page.getByText("You have used every attempt at this quiz.")).toBeVisible();
  });

  test("the browser never receives the answers, and forged answers earn nothing", async ({
    page,
    signInAs,
    baseURL,
  }) => {
    await signInAs("staff");
    const lessonId = await openQuizLesson(page);
    const headers = { origin: baseURL ?? "" };

    const lesson = await page.request.get(`/api/elearning/v1/lessons/${lessonId}`);
    const opened = await page.request.post(`/api/elearning/v1/lessons/${lessonId}/quiz/attempts`, {
      headers,
    });
    const attempt = (await opened.json()) as { id: string; survey: Survey };
    const raw = JSON.stringify([await lesson.json(), attempt]);
    for (const leak of [
      "correctOption",
      "correct_answer",
      "explanation",
      "Lifts can stop",
      "first-alarm",
    ]) {
      expect(raw).not.toContain(leak);
    }
    // Ticking every option and every value at once is not a way in.
    const forged: Record<string, unknown> = {};
    for (const element of attempt.survey.pages[0].elements) {
      const values = (element.choices ?? []).map((choice) => choice.value);
      if (element.type === "checkbox") forged[element.name] = values;
      if (element.type === "radiogroup") forged[element.name] = "o9";
      if (element.type === "boolean") forged[element.name] = true;
    }
    const submitted = await page.request.post(
      `/api/elearning/v1/lessons/${lessonId}/quiz/attempts/${attempt.id}/submit`,
      { headers, data: { answers: forged } },
    );

    expect(opened.status()).toBe(201);
    expect(await submitted.json()).toMatchObject({ score: 0, passed: false, corrections: null });
  });

  test("the SurveyJS form is accessible", async ({ page, signInAs }) => {
    await signInAs("staff");
    await openQuizLesson(page);

    await page.getByRole("button", { name: "Start the quiz" }).click();
    await expect(page.getByRole("radio", { name: "Raise the alarm" })).toBeVisible();

    await expectAccessible(page);
  });
});

import { expect, expectAccessible, test } from "./fixtures";

test.describe("learner journey", () => {
  test("a staff member completes a course, lesson by lesson", async ({ page, signInAs }) => {
    await signInAs("staff");
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Workplace safety" })).toBeVisible();
    await expect(page.getByText("You are not enrolled in any course.")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Workplace safety" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Workplace safety" })).toBeVisible();
    await expect(page.getByText("0 of 2 required lessons done")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Welcome" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Why safety matters" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("you can come back");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Lesson done" })).toBeVisible();

    await page.getByRole("link", { name: "Back to the course" }).click();
    await expect(page.getByText("1 of 2 required lessons done")).toBeVisible();
    await page.getByRole("link", { name: "Fire procedures" }).click();
    await expect(page.getByRole("table")).toContainText("Go to the meeting point");
    await page.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Lesson done" })).toBeVisible();

    await page.getByRole("link", { name: "Back to the course" }).click();
    await expect(page.getByText("Course completed")).toBeVisible();
    await page.goto("/");
    await expect(
      page
        .getByRole("region", { name: "My training" })
        .getByRole("link", { name: "Workplace safety" }),
    ).toBeVisible();
  });

  test("a self-enroll course can be joined from its page", async ({ page, signInAs }) => {
    await signInAs("staff");
    await page.goto("/training/workplace-safety");

    await page.getByRole("button", { name: "Enroll" }).click();

    await expect(page.getByRole("button", { name: "Enroll" })).toBeHidden();
    await page.goto("/");
    await expect(
      page
        .getByRole("region", { name: "My training" })
        .getByRole("link", { name: "Workplace safety" }),
    ).toBeVisible();
  });
});

test.describe("access rules", () => {
  test("staff do not see the managers' course, managers do", async ({ page, signInAs }) => {
    await signInAs("staff");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Workplace safety" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leading a team" })).toHaveCount(0);

    await page.goto("/training/leading-a-team");
    // Next.js adds its own (empty) route announcer with role="alert".
    await expect(
      page.getByRole("alert").filter({ hasText: "does not exist or is not available" }),
    ).toBeVisible();

    await signInAs("manager");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Leading a team" })).toBeVisible();
  });

  test("drafts are invisible to everyone on the learner side", async ({ page, signInAs }) => {
    await signInAs("admin");
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Workplace safety" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Next quarter's course" })).toHaveCount(0);
  });

  test("signed-out visitors are asked to sign in", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("alert").filter({ hasText: "Sign in to see your training." }).first(),
    ).toBeVisible();
  });
});

test.describe("API boundary", () => {
  test("refuses admin routes to learners and cross-origin writes", async ({
    page,
    signInAs,
    baseURL,
  }) => {
    await signInAs("staff");
    await page.goto("/");

    const admin = await page.request.get("/api/elearning/v1/admin/courses");
    const foreign = await page.request.post(
      "/api/elearning/v1/courses/00000000-0000-4000-8000-000000000000/enroll",
      {
        headers: { origin: "https://evil.example.net", "content-type": "application/json" },
        data: {},
      },
    );

    expect(admin.status()).toBe(403);
    expect(foreign.status()).toBe(403);
    expect(((await foreign.json()) as { error: { code: string } }).error.code).toBe(
      "origin_not_allowed",
    );
    expect(baseURL).toBeDefined();
  });

  test("sends the recommended security headers", async ({ page }) => {
    const response = await page.goto("/sign-in");

    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response?.headers()["x-powered-by"]).toBeUndefined();
  });
});

test("the demo sign-in switches users", async ({ page }) => {
  await page.goto("/sign-in");
  await expectAccessible(page);

  await page.getByRole("button", { name: "Morgan (manager)" }).click();

  await expect(page.getByRole("link", { name: "Leading a team" })).toBeVisible();
});

import { expect, test } from "./fixtures";

test("loads feedback once per screen across learner, admin and sign-in pages", async ({
  page,
  signInAs,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-feedback-loaded", "true");
  const script = page.locator("script#demo-feedback-widget");
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute("data-key", "ws_k_example");
  await expect(script).toHaveAttribute("async", "");
  await page.getByRole("link", { name: "Workplace safety", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-feedback-loaded", "true");
  await expect(script).toHaveCount(1);
  await signInAs("admin");
  await page.goto("/admin");
  await expect(page.locator("html")).toHaveAttribute("data-feedback-loaded", "true");
  await expect(script).toHaveCount(1);
  await page.getByRole("link", { name: "Edit Fire safety check", exact: true }).click();
  await page.locator(".el-author-lesson-link").first().click();
  await expect(page.locator("html")).toHaveAttribute("data-feedback-loaded", "true");
  await expect(script).toHaveCount(1);
  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveAttribute("data-feedback-loaded", "true");
  await expect(script).toHaveCount(1);
});

test("keeps training usable when the feedback vendor is unreachable", async ({ page }) => {
  await page.route("https://app.usedashly.com/widget/v1.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your training", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Workplace safety", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workplace safety", exact: true })).toBeVisible();
});

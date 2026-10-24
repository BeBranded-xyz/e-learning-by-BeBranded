import { expect, expectAccessible, test } from "./fixtures";

test("starts as a learner with the compact brand and source toolbar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("combobox", { name: "Demo profile" })).toHaveValue("staff");
  await expect(
    page.getByRole("link", { name: "Learning by BeBranded", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Visit BeBranded", exact: true })).toHaveAttribute(
    "href",
    "https://www.bebranded.xyz/",
  );
  await expect(
    page.getByRole("link", { name: "Source code on GitHub", exact: true }),
  ).toHaveAttribute("href", /github.com\/BeBranded-xyz/);
  await expect(page.getByRole("link", { name: "Workplace safety", exact: true })).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({ path: test.info().outputPath("demo-toolbar.png"), fullPage: true });
});

test("persists language across learner and admin pages and isolates role changes", async ({
  page,
  signInAs,
}) => {
  await signInAs("manager");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Leading a team", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { name: "Vos formations", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Profil de démonstration" }).selectOption("staff");
  await expect(page.getByRole("link", { name: "Leading a team", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Langue" })).toHaveValue("fr");
  await page.getByRole("combobox", { name: "Profil de démonstration" }).selectOption("admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Formations", exact: true })).toBeVisible();
  await expectAccessible(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.getByRole("combobox", { name: "Langue" }).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("opens the native lesson editor with French menus", async ({ page, signInAs }) => {
  await signInAs("admin");
  await page.goto("/admin");
  await page.getByRole("combobox", { name: "Language" }).selectOption("fr");
  await page
    .getByRole("link", { name: "Modifier Bienvenue dans votre espace de formation", exact: true })
    .click();
  await page.getByRole("link", { name: "Découvrir la plateforme", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enregistrer le contenu" })).toBeVisible();
  const editor = page.locator(".bn-editor");
  await editor.locator(".bn-inline-content").last().click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/titre");
  await expect(page.getByRole("option", { name: "Titre 1", exact: false })).toBeVisible();
});

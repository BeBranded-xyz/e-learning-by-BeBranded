import type { Page } from "@playwright/test";
import { expect, expectAccessible, test } from "./fixtures";

test("keeps the header and sidebar inside the viewport with independent content scrolling", async ({
  page,
  signInAs,
}, info) => {
  await signInAs("admin");
  await page.goto("/admin");
  await page.getByRole("link", { name: "Edit Fire safety check", exact: true }).click();
  await expect(page.locator(".el-admin-chapter").first()).toBeVisible();
  if (info.project.name === "mobile") await page.locator(".demo-admin-menu").click();
  const geometry = await page.evaluate(() => ({
    document: document.documentElement.scrollHeight,
    viewport: innerHeight,
    headerBottom: document.querySelector(".demo-site-header")?.getBoundingClientRect().bottom ?? 0,
    sidebar: {
      top: document.querySelector(".demo-admin-sidebar")?.getBoundingClientRect().top,
      bottom: document.querySelector(".demo-admin-sidebar")?.getBoundingClientRect().bottom,
    },
  }));
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.sidebar.bottom).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.sidebar.top).toBeCloseTo(geometry.headerBottom, 0);
  await page.locator(".demo-admin-content").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await page
      .locator(".demo-site-header")
      .evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(0);
  await expectAccessible(page);
});

test("separates the catalog creation action from the course list", async ({ page, signInAs }) => {
  await signInAs("admin");
  await page.goto("/admin");
  await expect(page.locator(".el-author-course-card").first()).toBeVisible();
  const action = await page.locator(".el-author-create-card").boundingBox();
  const list = await page.locator(".el-author-course-grid").boundingBox();
  expect((list?.y ?? 0) - (action?.y ?? 0) - (action?.height ?? 0)).toBeGreaterThanOrEqual(15);
});

async function createCourseSettings(page: Page, title: string) {
  await page.goto("/admin");
  await page.locator(".el-author-create-card").click();
  await expect(page).toHaveURL(/\/admin\/courses\/new$/);
  const form = page.getByRole("form", { name: "New course" });
  await form.getByLabel("Title", { exact: true }).fill(title);
  await form.getByLabel("Summary").fill("An easy course to build.");
  await form.getByLabel("Language").selectOption("es");
  expect(await form.getByLabel("Language").locator("option").count()).toBeGreaterThan(180);
  await expectAccessible(page);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Structure" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

async function buildChapter(page: Page) {
  await page.getByLabel("New chapter title").fill("Introduction");
  await page.getByRole("button", { name: "Add a chapter", exact: true }).click();
  const chapter = page.getByRole("listitem", { name: "Introduction" });
  await expect(chapter).toBeVisible();
  await expect(chapter.getByRole("form", { name: "Add a lesson" })).not.toBeVisible();
  await expect(chapter.getByRole("button", { name: "Publish", exact: true })).not.toBeVisible();
  await chapter.locator(".el-author-add-lesson > summary").click();
  await chapter.getByLabel("New lesson title").fill("Welcome");
  await chapter.getByRole("button", { name: "Add a lesson", exact: true }).click();
  await expect(chapter.getByRole("link", { name: "Welcome", exact: true })).toBeVisible();
  await chapter.locator(".el-author-add-lesson > summary").click();
  await chapter.getByLabel("Actions for Introduction", { exact: true }).click();
  await chapter.getByText("Edit", { exact: true }).click();
  await chapter.getByLabel("Chapter title").fill("First steps");
  await chapter.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "First steps", exact: true })).toBeVisible();
  await page.getByLabel("Actions for First steps", { exact: true }).click();
}

async function expectAuthoringSpacing(page: Page) {
  const field = await page.getByLabel("New chapter title").boundingBox();
  const action = await page
    .getByRole("button", { name: "Add a chapter", exact: true })
    .boundingBox();
  expect(field).not.toBeNull();
  expect(action).not.toBeNull();
  if (field === null || action === null) throw new Error("Chapter form has no layout");
  const horizontal = action.x - field.x - field.width;
  const vertical = action.y - field.y - field.height;
  expect(Math.max(horizontal, vertical)).toBeGreaterThanOrEqual(15);
  const lesson = await page.locator(".el-admin-lesson").first().boundingBox();
  const creation = await page.locator(".el-author-add-lesson").first().boundingBox();
  expect(lesson).not.toBeNull();
  expect(creation).not.toBeNull();
  if (lesson === null || creation === null) throw new Error("Chapter content has no layout");
  expect(creation.y - lesson.y - lesson.height).toBeGreaterThanOrEqual(15);
}

test("creates a course on its settings page, then edits a clean chapter outline", async ({
  page,
  signInAs,
}, info) => {
  await signInAs("admin");
  await createCourseSettings(page, `Navigation ${info.project.name}`);
  await buildChapter(page);
  await expectAuthoringSpacing(page);
  await expectAccessible(page);
  await page.locator(".demo-admin-content").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: info.outputPath("course-outline.png") });
  await page.getByRole("tab", { name: "Structure" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Settings" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel", { name: "Settings" }).getByLabel("Language")).toHaveValue(
    "es",
  );
  await page.locator(".demo-admin-content").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: info.outputPath("course-settings.png") });
});

test("protects the creation form from input before hydration completes", async ({
  page,
  signInAs,
}) => {
  await signInAs("admin");
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/admin/courses/new", { waitUntil: "commit" });
  const title = page.getByLabel("Title", { exact: true });
  try {
    await expect(title).toBeDisabled();
  } finally {
    release();
  }
  await expect(title).toBeEnabled();
  await title.fill("Hydrated title");
  await expect(page.getByLabel("URL slug")).toHaveValue("hydrated-title");
});

test("dismisses chapter actions after publishing, outside clicks and Escape", async ({
  page,
  signInAs,
}, info) => {
  const title = `Action dismissal ${info.project.name}`;
  await signInAs("admin");
  await createCourseSettings(page, title);
  await page.getByLabel("New chapter title").fill("Actions");
  await page.getByRole("button", { name: "Add a chapter", exact: true }).click();
  const chapter = page.getByRole("listitem", { name: "Actions", exact: true });
  const trigger = chapter.getByLabel("Actions for Actions", { exact: true });
  const menu = chapter.locator(".el-chapter-actions");
  await trigger.click();
  await chapter.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(chapter.getByText("Published", { exact: true })).toBeVisible();
  await expect(menu).not.toHaveAttribute("open", "");
  await trigger.click();
  await page.getByRole("heading", { name: title, exact: true }).click();
  await expect(menu).not.toHaveAttribute("open", "");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();
});

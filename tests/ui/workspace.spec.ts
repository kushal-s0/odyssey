import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
test("public home explains the workflow and private routes require sign-in", async ({
  page,
}) => {
  const { requests } = await mockWorkspace(page, null);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your business idea. A place to grow." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create your account" }),
  ).toBeVisible();
  expect(requests).not.toContain("/submissions");
  expect(requests).not.toContain("/dashboard");
  expect(requests).not.toContain("/examples");
  await page.screenshot({
    path: ".planning/screenshots/home-desktop.png",
    fullPage: true,
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace." }),
  ).toBeVisible();
  await page.goto("/model");
  await expect(page).toHaveURL(/\/login\?next=/);
});
test("assessor dashboard navigation and filtering use authenticated records", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockWorkspace(page, "assessor");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "A clearer view of every idea." }),
  ).toBeVisible();
  await expect(page.getByText("LIVE WORKSPACE", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "All submissions", exact: false })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Search submissions" })
    .fill("poultry");
  await expect(
    page.getByRole("link", {
      name: "Small-scale poultry farming",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Home-style tiffin service", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Small-scale poultry farming", exact: true })
    .click();
  await expect(
    page.getByText("Not assessable", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Version history" }).click();
  await expect(
    page.getByText("Initial extraction and assessment."),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("authenticated assessor can access input formats, comparisons, model status and settings", async ({
  page,
}) => {
  await mockWorkspace(page, "assessor");
  await page.goto("/submit");
  await page.getByRole("button", { name: "Upload a PDF" }).click();
  await expect(
    page.getByRole("heading", { name: "Drop your document here" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Record or upload" }).click();
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeVisible();
  await page.goto("/comparisons");
  await page.getByRole("button", { name: "By trade", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Trade-wise comparison" }),
  ).toBeVisible();
  await page.goto("/model");
  await expect(page.getByText("Training not verified")).toBeVisible();
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Connections & settings" }),
  ).toBeVisible();
  await expect(
    page.getByText("Groq fallback API", { exact: true }),
  ).toBeVisible();
});
test("entrepreneur dashboard exposes personal metrics and sign-out clears private data", async ({
  page,
}) => {
  const { records, requests } = await mockWorkspace(page, "entrepreneur");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("MY LATEST ASSESSMENT", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Comparisons", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Programme overview", { exact: true }),
  ).toHaveCount(0);
  expect(requests).not.toContain("/cohorts");
  expect(requests).not.toContain("/examples");
  await page.screenshot({
    path: ".planning/screenshots/personal-dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(records[0].title, { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
test("mobile home, authentication and personal dashboard fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(page, null);
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".planning/screenshots/home-mobile.png",
    fullPage: true,
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("long-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".planning/screenshots/personal-dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "My submissions", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "My submissions", exact: true }),
  ).toBeVisible();
});

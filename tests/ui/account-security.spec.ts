import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
test("sign-out is a visible text action on mobile without opening navigation", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const button = page.getByRole("button", { name: "Sign out", exact: true });
  await expect(button).toBeVisible();
  await expect(button).toContainText("Sign out");
  const bounds = await button.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: ".planning/screenshots/visible-signout-mobile.png",
    fullPage: false,
  });
  await button.click();
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText("You have been signed out.", { exact: true }),
  ).toBeVisible();
});
test("sign-out in one tab removes private data in other open tabs", async ({
  page,
  context,
}) => {
  const { records } = await mockWorkspace(context, "entrepreneur");
  const other = await context.newPage();
  await page.goto("/dashboard");
  await other.goto("/dashboard");
  await expect(
    other.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(other).toHaveURL(/\/login/);
  await expect(other.getByText(records[0].title, { exact: true })).toHaveCount(
    0,
  );
  await other.reload();
  await expect(
    other.getByRole("heading", { name: "Sign in to your workspace." }),
  ).toBeVisible();
});
test("failed server revocation is disclosed and keeps a retry available", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error:
          "Sign-out could not be confirmed because the database is unavailable. Please retry.",
      },
    }),
  );
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByText("Sign-out could not be confirmed", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeEnabled();
});
test("settings exposes browser and all-device logout for both roles", async ({
  page,
}) => {
  await mockWorkspace(page, "assessor");
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Account security", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign out of this browser", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sign out all devices", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText("You have been signed out on all devices.", { exact: true }),
  ).toBeVisible();
});
test("password changes check confirmation and clear the session after success", async ({
  page,
}) => {
  const { requests } = await mockWorkspace(page, "entrepreneur");
  await page.goto("/settings");
  await page
    .getByLabel("Current password", { exact: true })
    .fill("original-test-password");
  await page
    .getByLabel("New password", { exact: true })
    .fill("replacement-test-password");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("different-test-password");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(
    page.getByText("The new passwords do not match.", { exact: true }),
  ).toBeVisible();
  expect(requests).not.toContain("/auth/password");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("replacement-test-password");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText(
      "Your password was updated. Sign in with your new password.",
      { exact: true },
    ),
  ).toBeVisible();
});
test("expired sessions clear private screens and explain the sign-in requirement", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({ status: 401, json: { error: "Please sign in again." } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText(
      "Your session expired or was revoked. Please sign in again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(records[0].title, { exact: true })).toHaveCount(
    0,
  );
});
test("an old unauthorized response cannot sign out a newly authenticated session", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  let release!: () => void, started!: () => void;
  const waiting = new Promise<void>((resolve) => {
      release = resolve;
    }),
    seen = new Promise<void>((resolve) => {
      started = resolve;
    });
  let intercepted = false;
  await page.route("**/api/dashboard", async (route) => {
    if (intercepted) {
      await route.fallback();
      return;
    }
    intercepted = true;
    started();
    await waiting;
    await route.fulfill({
      status: 401,
      json: { error: "Old session expired" },
    });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await seen;
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("long-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
  const late = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/dashboard") && response.status() === 401,
  );
  release();
  await (await late).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "My dashboard", exact: true }),
  ).toBeVisible();
});

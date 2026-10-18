import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";

for (const path of ["/login", "/register"]) {
  test(`${path} recovers when the initial API request fails without blaming the database`, async ({
    page,
  }) => {
    await mockWorkspace(page, null);
    let offline = true;
    await page.route("**/api/session", (route) =>
      offline
        ? route.fulfill({ status: 500, contentType: "text/plain", body: "" })
        : route.fallback(),
    );
    await page.clock.install();
    await page.goto(path);
    await expect(
      page.getByText(
        "The workspace service is temporarily unavailable. Rechecking automatically.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("The workspace database is currently unavailable.", {
        exact: false,
      }),
    ).toHaveCount(0);
    const submit = page.getByRole("button", {
      name: path === "/login" ? "Sign in" : "Create account",
      exact: true,
    });
    await expect(submit).toBeDisabled();
    await page
      .getByLabel("Email", { exact: true })
      .fill("api-recovery@example.test");
    offline = false;
    await page.clock.fastForward(10000);
    await expect(submit).toBeEnabled();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "api-recovery@example.test",
    );
  });
}

test("a failed service check preserves a retry action and recovers manually", async ({
  page,
}) => {
  await mockWorkspace(page, null);
  let offline = true;
  await page.route("**/api/session", (route) =>
    offline ? route.abort("connectionrefused") : route.fallback(),
  );
  await page.goto("/login");
  const check = page.getByRole("button", {
    name: "Check connection",
    exact: true,
  });
  await expect(check).toBeVisible();
  await check.click();
  await expect(check).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  offline = false;
  await check.click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
});

for (const path of ["/login", "/register"]) {
  test(`${path} enables account access automatically after database recovery`, async ({
    page,
  }) => {
    const { health } = await mockWorkspace(page, null);
    health.database = false;
    await page.clock.install();
    await page.goto(path);
    const submit = page.getByRole("button", {
      name: path === "/login" ? "Sign in" : "Create account",
      exact: true,
    });
    await expect(submit).toBeDisabled();
    await page
      .getByLabel("Email", { exact: true })
      .fill("recovery@example.test");
    health.database = true;
    await page.clock.fastForward(10000);
    await expect(submit).toBeEnabled();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "recovery@example.test",
    );
    await expect(
      page.getByRole("button", { name: "Check connection" }),
    ).toHaveCount(0);
  });
}

test("the connection check immediately refreshes availability without losing form input", async ({
  page,
}) => {
  const { health } = await mockWorkspace(page, null);
  health.database = false;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Recovery Test");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeDisabled();
  health.database = true;
  await page
    .getByRole("button", { name: "Check connection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Full name")).toHaveValue("Recovery Test");
});

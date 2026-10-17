import { test, expect, type Page } from "@playwright/test";
import { examples } from "../../server/src/examples";

const recordId = "aaaaaaaaaaaaaaaaaaaaaaaa";
async function workspace(page: Page, role: "entrepreneur" | "assessor" | null) {
  let user = role
    ? {
        id: "bbbbbbbbbbbbbbbbbbbbbbbb",
        name: "Test Entrepreneur",
        email: "test@example.test",
        role,
      }
    : null;
  const record = {
    ...JSON.parse(JSON.stringify(examples[0])),
    id: recordId,
    example: false,
    beneficiaryName: "Test Entrepreneur",
  };
  const writes: { path: string; body: string }[] = [];
  const health = {
    database: true,
    gemini: true,
    sarvam: true,
    classifier: false,
    examples: true,
    maxUploadMb: 10,
    audioProvider: "sarvam",
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice(4);
    let body: unknown = {};
    if (request.method() === "POST")
      writes.push({ path, body: request.postData() ?? "" });
    if (path === "/session") body = { user, health };
    else if (path === "/health") body = health;
    else if (path === "/examples")
      body = { submissions: examples, cohorts: [] };
    else if (path === "/cohorts") body = { cohorts: [] };
    else if (path === "/auth/register") {
      user = {
        id: "bbbbbbbbbbbbbbbbbbbbbbbb",
        ...request.postDataJSON(),
        role: "entrepreneur",
      };
      body = { user };
    } else if (path === "/submissions" && request.method() === "GET")
      body = { submissions: [record] };
    else if (path === "/submissions") body = { submission: record };
    else if (path.endsWith("/similar")) body = { matches: [] };
    else if (path.endsWith("/review")) {
      record.review = {
        ...request.postDataJSON(),
        reviewedAt: new Date().toISOString(),
      };
      body = { submission: record };
    } else if (path === `/submissions/${recordId}`)
      body = { submission: record };
    await route.fulfill({
      status:
        path === "/submissions" && request.method() === "POST" ? 202 : 200,
      json: body,
    });
  });
  return writes;
}

test("entrepreneur registration checks confirmation and never asks for a privileged role", async ({
  page,
}) => {
  const writes = await workspace(page, null);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Create entrepreneur account" })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Test Entrepreneur");
  await page.getByLabel("Email", { exact: true }).fill("person@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("long-test-passphrase");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("different-passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("The passwords do not match.")).toBeVisible();
  expect(writes).toHaveLength(0);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("long-test-passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "My submissions", exact: false }).first(),
  ).toBeVisible();
  expect(
    JSON.parse(writes.find((write) => write.path === "/auth/register")!.body),
  ).not.toHaveProperty("role");
});

test("entrepreneur navigation and direct routes hide assessor tools", async ({
  page,
}) => {
  await workspace(page, "entrepreneur");
  await page.goto("/model");
  await expect(
    page.getByRole("heading", { name: "Assessor access required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Comparisons", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/submissions/${recordId}`);
  await expect(page.getByRole("button", { name: "Add review" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Similar ideas & local context" }),
  ).toHaveCount(0);
});

test("guided input rejects excess funding and serializes unknown amounts as null", async ({
  page,
}) => {
  const writes = await workspace(page, "entrepreneur");
  await page.goto("/submit");
  await expect(page.getByLabel("Entrepreneur name")).toHaveValue(
    "Test Entrepreneur",
  );
  await page.getByLabel("Idea title", { exact: true }).fill("Test tea stall");
  await page
    .locator("#guided-products")
    .fill("Tea and fresh biscuits for commuters.");
  await page.locator("#guided-investment").fill("100");
  await page.locator("#guided-selfInvestment").fill("80");
  await page.locator("#guided-loan").fill("50");
  await page.getByRole("button", { name: "Submit for assessment" }).click();
  await expect(
    page
      .getByText("Own investment plus funding needed exceeds", { exact: false })
      .first(),
  ).toBeVisible();
  expect(writes.filter((write) => write.path === "/submissions")).toHaveLength(
    0,
  );
  await page.locator("#guided-selfInvestment").fill("50");
  await page.getByRole("button", { name: "Submit for assessment" }).click();
  await expect
    .poll(() => writes.filter((write) => write.path === "/submissions").length)
    .toBe(1);
  const body = writes.find((write) => write.path === "/submissions")!.body;
  expect(body).toContain('"monthlyRevenue":null');
  expect(body).toContain('name="structuredInput"');
  expect(body).not.toContain('name="originalText"');
});

test("assessor sign-off needs reasons, cited evidence and a source confirmation", async ({
  page,
}) => {
  const writes = await workspace(page, "assessor");
  await page.goto(`/submissions/${recordId}`);
  await page.getByRole("button", { name: "Add review" }).click();
  const dialog = page.getByRole("dialog", { name: "Record assessor review" });
  await dialog.getByLabel("Recommended next step").selectOption("mentoring");
  await dialog
    .getByLabel("Review rationale")
    .fill("The proposal needs support with customer validation.");
  await dialog
    .getByLabel("Next action", { exact: false })
    .fill("Arrange a mentoring session to plan customer research.");
  await dialog
    .getByRole("checkbox", {
      name: "I reviewed the original source",
      exact: false,
    })
    .check();
  await dialog.getByRole("button", { name: "Save review" }).click();
  await expect(
    dialog.getByText("Select at least one review reason.", { exact: false }),
  ).toBeVisible();
  expect(writes.filter((write) => write.path.endsWith("/review"))).toHaveLength(
    0,
  );
  await dialog
    .getByRole("checkbox", { name: "Mentoring or skills support" })
    .check();
  await dialog
    .locator("fieldset")
    .nth(1)
    .locator('input[type="checkbox"]')
    .first()
    .check();
  await dialog.getByRole("button", { name: "Save review" }).click();
  await expect(dialog).toHaveCount(0);
  const review = JSON.parse(
    writes.find((write) => write.path.endsWith("/review"))!.body,
  );
  expect(review.sourceReviewed).toBe(true);
  expect(review.evidenceIds).toHaveLength(1);
  expect(review.reasonCodes).toEqual(["skills_support"]);
});

test("guided entrepreneur form fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace(page, "entrepreneur");
  await page.goto("/submit");
  await expect(page.locator("#guided-products")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".planning/screenshots/guided-form-mobile.png",
    fullPage: true,
  });
});

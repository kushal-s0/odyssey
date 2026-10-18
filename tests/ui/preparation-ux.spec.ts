import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
import { assess } from "../../server/src/domain/assessment";
test("guided preparation shows financial checks and a normalized preview without submitting", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/submissions"
    )
      writes++;
  });
  await page.goto("/submit");
  await page.getByRole("button", {name:"Guided form",exact:true}).click();
  await page
    .getByLabel("Idea title", { exact: true })
    .fill("Neighbourhood tea stall");
  await page
    .locator("#guided-products")
    .fill("Tea and biscuits for commuters.");
  await page.locator("#guided-monthlyRevenue").fill("20,000");
  await page.locator("#guided-monthlyCosts").fill("12000");
  await expect(page.locator(".draft-financials")).toContainText("₹8,000");
  await page
    .getByRole("button", { name: "Preview standardized input" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Review your submission" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("pre")).toContainText("INR 20000.00 per month");
  await expect(dialog.locator("pre")).not.toContainText(
    "Own investment: INR 0",
  );
  expect(writes).toBe(0);
  await dialog.getByRole("button", { name: "Continue editing" }).click();
  await expect(page.locator("#guided-monthlyRevenue")).toHaveValue("20,000");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".planning/screenshots/guided-preparation-desktop.png",
    fullPage: false,
  });
});
test("preview identifies the invalid field and preserves entered answers", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  await page.goto("/submit");
  await page.getByRole("button", {name:"Guided form",exact:true}).click();
  await page.getByLabel("Idea title", { exact: true }).fill("Tea stall");
  await page
    .locator("#guided-products")
    .fill("Tea and biscuits for commuters.");
  await page.locator("#guided-unitPrice").fill("10");
  await page
    .getByRole("button", { name: "Preview standardized input" })
    .click();
  await expect(page.locator("#guided-priceUnit")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator("#guided-priceUnit").fill("cup");
  await page
    .getByRole("button", { name: "Preview standardized input" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("missing questions can be filtered and reset, and the checklist downloads", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  records[0]!.assessment = assess({
    fields: [],
    segments: [],
    language: "English",
    providerModel: "test",
  });
  await page.goto(`/submissions/${records[0]!.id}`);
  const panel = page.locator(".completion-panel");
  await panel.getByRole("button", { name: /Finances/ }).click();
  await expect(panel.locator(".completion-question")).toHaveCount(6);
  await panel.getByLabel("Search missing information").fill("monthly");
  await expect(panel.locator(".completion-question")).toHaveCount(2);
  await panel.getByLabel("Search missing information").fill("unmatched phrase");
  await expect(
    panel.getByText("No questions match these filters"),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Show all open questions" }).click();
  await expect(panel.locator(".completion-question")).toHaveCount(19);
  const pending = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download checklist" }).click();
  const downloaded = await pending;
  expect(downloaded.suggestedFilename()).toBe("strive-checklist-v1.txt");
});
test("guided preparation and preview fit on mobile with keyboard-accessible navigation", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/submit");
  await page.getByRole("button", {name:"Guided form",exact:true}).click();
  await page.screenshot({
    path: ".planning/screenshots/guided-preparation-mobile-compact.png",
    fullPage: false,
  });
  await expect(
    page.getByText("Preparation tools", { exact: false }),
  ).toBeVisible();
  await page.locator(".preparation-tools > summary").click();
  await expect(
    page.getByRole("navigation", { name: "Guided form sections" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".planning/screenshots/guided-preparation-mobile.png",
    fullPage: false,
  });
  await page.getByRole("link", { name: /Financial assumptions/ }).click();
  await expect(page).toHaveURL(/#guided-section-finances/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Idea title", { exact: true }).fill("Tea stall");
  await page
    .locator("#guided-products")
    .fill("Tea and biscuits for commuters.");
  await page
    .getByRole("button", { name: "Preview submission", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".planning/screenshots/input-preview-mobile.png",
    fullPage: false,
  });
});

test("reviewed input submits once through the normal validated submission flow", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  let writes = 0;
  await page.route("**/api/submissions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    writes++;
    expect(route.request().postData()).toContain('name="structuredInput"');
    await route.fulfill({ status: 202, json: { submission: records[0] } });
  });
  await page.goto("/submit");
  await page.getByRole("button", {name:"Guided form",exact:true}).click();
  await page.getByLabel("Idea title", { exact: true }).fill("Tea stall");
  await page
    .locator("#guided-products")
    .fill("Tea and biscuits for commuters.");
  await page
    .getByRole("button", { name: "Preview submission", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(writes).toBe(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit for assessment" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/submissions/${records[0]!.id}$`));
  expect(writes).toBe(1);
});

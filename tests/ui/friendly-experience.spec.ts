import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
import { assess } from "../../server/src/domain/assessment";
import { readFileSync } from "node:fs";

test("visual overview opens help and original answers without exposing assessor tools", async ({
  page,
}) => {
  const { records, requests } = await mockWorkspace(page, "entrepreneur");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await expect(page.locator(".idea-area")).toHaveCount(4);
  await expect(page.locator(".next-step-card")).toHaveCount(2);
  await expect(page.locator(".score-orbit strong")).toHaveText(
    String(records[0]!.assessment!.score),
  );
  await expect(page.locator(".score-explanation")).not.toHaveAttribute(
    "open",
    "",
  );
  const help = page.getByRole("button", {
    name: "More about Details score",
    exact: true,
  });
  await help.hover();
  await expect(page.locator(".friendly-help-card:visible")).toContainText(
    "75 out of 100",
  );
  await help.click();
  await help.press("Escape");
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".friendly-help-card:visible")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open Your idea", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    records[0]!.assessment!.fields.find((f) => f.key === "products")!.value!,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .locator(".next-step-card")
    .first()
    .getByRole("button", { name: "Show me how" })
    .click();
  await expect(page.locator(".step-instructions").first()).toBeVisible();
  await page.screenshot({
    path: ".planning/screenshots/friendly-dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "See my answers", exact: true })
    .click();
  await expect(page.getByTestId("open-full-view")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".source-segment").first()).toContainText(
    records[0]!.assessment!.segments[0]!.originalText,
  );
  expect(
    requests.some((p) =>
      /\/local-context|\/decision-support|\/similar|\/cohorts/.test(p),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test("mobile overview uses all six languages, supports tap help and fits the screen", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/submissions/${records[0]!.id}`);
  for (const code of ["hi", "mr", "te", "bn", "od", "en"]) {
    const catalog = JSON.parse(
      readFileSync(
        new URL(`../../client/src/locales/${code}.json`, import.meta.url),
        "utf8",
      ),
    );
    await page
      .getByRole("combobox", { name: "Website language" })
      .selectOption(`${code}-IN`);
    await expect(page.locator(".visualizer-heading h2")).toHaveText(
      catalog["Your idea at a glance"],
    );
    await expect(page.locator(".idea-area")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "More about Details score", exact: true })
    .click();
  await expect(page.locator(".friendly-help-card:visible")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close help" }).click();
  await expect(page.locator(".friendly-help-card:visible")).toHaveCount(0);
  await page.mouse.click(10, 10);
  await page.screenshot({
    path: ".planning/screenshots/friendly-overview-mobile.png",
    fullPage: true,
  });
});
test("missing details keep score unknown, show one useful action and open the right answer form", async ({
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
  await expect(page.locator(".score-orbit strong")).toHaveText("--");
  await expect(page.locator(".area-dots .done")).toHaveCount(0);
  await expect(page.locator(".next-step-card").first()).toContainText(
    "Add one missing detail",
  );
  await page
    .locator(".next-step-card")
    .first()
    .getByRole("button", { name: "Show me how" })
    .click();
  await page
    .getByRole("button", { name: "Add this answer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Information to clarify")).toHaveValue(
    records[0]!.assessment!.questions[0]!.id,
  );
});
test("support options stay optional, link to official sources and do not promise eligibility", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  await page.goto("/dashboard");
  const support = page.locator(".support-explorer");
  await expect(support).not.toHaveAttribute("open", "");
  await support.locator("summary").click();
  await expect(support).toContainText("not an eligibility check");
  await expect(
    support.getByRole("link", { name: "Open official website" }),
  ).toHaveCount(3);
  for (const a of await support
    .getByRole("link", { name: "Open official website" })
    .all()) {
    expect(await a.getAttribute("href")).toMatch(
      /^https:\/\/(udyamregistration\.gov\.in|www\.jansamarth\.in|financialservices\.gov\.in)\//,
    );
  }
  await expect(support).toContainText("loan must be repaid");
});

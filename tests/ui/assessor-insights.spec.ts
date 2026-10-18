import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
import { assess } from "../../server/src/domain/assessment";
function assessed() {
  return assess({
    fields: [],
    segments: [],
    language: "English",
    providerModel: "test",
  });
}
test("assessor sees explainable financial risk with unknowns instead of invented figures", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  records[0]!.assessment = assessed();
  await page.goto(`/submissions/${records[0]!.id}`);
  const support = page.locator(".assessor-insights");
  await expect(
    support.getByRole("heading", { name: "Assessor decision support" }),
  ).toBeVisible();
  await expect(
    support.getByText("Not enough details", { exact: true }),
  ).toBeVisible();
  await expect(support.getByText("Not available", { exact: true })).toHaveCount(
    4,
  );
  await expect(support.getByText("0 / 100", { exact: true })).toHaveCount(0);
});
test("entrepreneurs do not receive assessor decision support or nearby business requests", async ({
  page,
}) => {
  const { records, requests } = await mockWorkspace(page, "entrepreneur");
  await page.goto(`/submissions/${records[0]!.id}`);
  await expect(page.locator(".idea-visualizer")).toBeVisible();
  await expect(page.locator(".assessor-insights")).toHaveCount(0);
  expect(
    requests.some(
      (p) => p.includes("decision-support") || p.startsWith("/locations"),
    ),
  ).toBe(false);
});
test("nearby lookup requires a confirmed place and category and clears stale results", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  await page.route("**/api/locations/search?*", (route) =>
    route.fulfill({
      json: {
        locations: [
          { id: "1", name: "Pune, Maharashtra", lat: 18.52, lon: 73.85 },
        ],
      },
    }),
  );
  await page.route("**/api/locations/businesses", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      lat: 18.52,
      lon: 73.85,
      category: "tailoring",
      radius: 1000,
    });
    await route.fulfill({
      json: {
        status: "available",
        businesses: [
          {
            id: "node/1",
            name: "Mapped tailor",
            category: "tailor",
            distanceMeters: 250,
            url: "https://www.openstreetmap.org/node/1",
            lat: 18.52,
            lon: 73.85,
          },
        ],
        retrievedAt: new Date().toISOString(),
        radiusMeters: 1000,
        attribution: "© OpenStreetMap contributors",
        message: "Mapped listings are incomplete.",
      },
    });
  });
  await page.goto(`/submissions/${records[0]!.id}`);
  await page
    .getByRole("button", { name: "Find nearby similar businesses" })
    .click();
  const panel = page.locator(".location-panel");
  const lookup = panel.getByRole("button", {
    name: "Look up mapped businesses",
  });
  await expect(lookup).toBeDisabled();
  await panel.getByLabel("Business location", { exact: true }).fill("Pune");
  await panel.getByRole("button", { name: "Find location" }).click();
  await panel.getByLabel("Confirm the correct location").selectOption("1");
  await expect(lookup).toBeDisabled();
  await panel.getByLabel("Business category").selectOption("tailoring");
  await panel.getByLabel("Search radius").selectOption("1000");
  await lookup.click();
  await expect(
    panel.getByRole("link", { name: /Mapped tailor/ }),
  ).toHaveAttribute("href", "https://www.openstreetmap.org/node/1");
  await expect(panel.getByText("1 mapped listings within 1 km")).toBeVisible();
  await panel.getByLabel("Business category").selectOption("food");
  await expect(panel.getByText("Mapped tailor", { exact: true })).toHaveCount(
    0,
  );
});
test("assessor financial support fits on mobile", async ({ page }) => {
  const { records } = await mockWorkspace(page, "assessor");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/submissions/${records[0]!.id}`);
  await expect(page.locator(".risk-summary")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".assessor-insights").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".planning/screenshots/assessor-risk-mobile.png",
    fullPage: false,
  });
});

import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
import { assess } from "../../server/src/domain/assessment";
import type { SourceSegment } from "../../shared/types";

test("a delayed previous assessment cannot replace the source of the current record", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  let release: () => void = () => {},
    requested: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      requested = resolve;
    });
  await page.route(`**/api/submissions/${records[0]!.id}`, async (route) => {
    requested();
    await waiting;
    await route.fulfill({ json: { submission: records[0] } });
  });
  await page.goto(`/submissions/${records[0]!.id}`);
  await started;
  await page.evaluate((id) => {
    history.pushState({}, "", `/submissions/${id}`);
    dispatchEvent(new PopStateEvent("popstate"));
  }, records[1]!.id);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: records[1]!.title,
      exact: true,
    }),
  ).toBeVisible();
  const oldResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/submissions/${records[0]!.id}`,
  );
  release();
  await (await oldResponse).finished();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: records[0]!.title,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".evidence-panel")).toBeVisible();
});

test("switching submissions clears source selection and confirmation", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  await page.goto(`/submissions/${records[0]!.id}?view=full`);
  const panel = page.locator(".evidence-panel");
  await panel.locator('.source-segment input[type="checkbox"]').first().check();
  await panel
    .getByLabel("I compared the selected original passages", { exact: false })
    .check();
  await page.evaluate((id) => {
    history.pushState({}, "", `/submissions/${id}`);
    dispatchEvent(new PopStateEvent("popstate"));
  }, records[1]!.id);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: records[1]!.title,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Confirm selected evidence" }),
  ).toBeDisabled();
  await expect(
    panel.locator('.source-segment input[type="checkbox"]:checked'),
  ).toHaveCount(0);
});

test("evidence opens original and English together, follows citations and deep-links the PDF page", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  const segments: SourceSegment[] = [
    {
      id: "s1",
      originalText: "दूध विक्री. महिन्याची विक्री INR 30000.",
      englishText: "Milk sales. Monthly sales INR 30000.",
      page: 2,
      startSeconds: null,
      endSeconds: null,
      kind: "pdf",
      verified: false,
    },
    {
      id: "s2",
      originalText: "ग्राहक स्थानिक कुटुंबे आहेत.",
      englishText: "Customers are local families.",
      page: 3,
      startSeconds: null,
      endSeconds: null,
      kind: "pdf",
      verified: false,
    },
  ];
  records[0]!.inputType = "pdf";
  records[0]!.fileName = "synthetic.pdf";
  records[0]!.assessment = assess({
    fields: [
      {
        key: "monthlyRevenue",
        value: "INR 30000",
        status: "supported",
        evidenceIds: ["s1"],
        reason: "Quoted",
      },
    ],
    segments,
    language: "mr-IN",
    providerModel: "synthetic-test",
  });
  await page.goto(`/submissions/${records[0]!.id}?view=full`);
  const panel = page.locator(".evidence-panel");
  await expect(
    panel.getByRole("button", { name: "Side by side", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator(".evidence-passages section")).toHaveCount(4);
  await page
    .locator(".friendly-detail-group")
    .filter({ has: page.locator(".facts-grid") })
    .locator(":scope > summary")
    .click();
  await page
    .locator(".fact")
    .filter({ hasText: "Expected monthly sales" })
    .getByRole("button", { name: "1 source reference" })
    .click();
  await expect(panel.locator(".source-segment")).toHaveCount(1);
  await expect(panel.locator("mark").first()).toHaveText("INR 30000");
  await panel.getByRole("button", { name: "Open this page" }).click();
  await expect(panel.locator("iframe")).toHaveAttribute(
    "src",
    /source#page=2$/,
  );
  await panel
    .getByRole("button", { name: "Expand evidence workspace" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Source evidence workspace",
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Side by side", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Confirm selected evidence" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("I compared the selected original passages", { exact: false })
    .check();
  await expect(
    dialog.getByRole("button", { name: "Confirm selected evidence" }),
  ).toBeEnabled();
  await page.screenshot({
    path: ".planning/screenshots/evidence-workspace-desktop.png",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("source evidence search, state filters and mobile layout remain readable", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/submissions/${records[0]!.id}?view=full`);
  await page.getByRole("button", { name: "Open sources", exact: true }).click();
  const panel = page.locator(".evidence-panel");
  await panel.scrollIntoViewIfNeeded();
  await panel
    .getByLabel("Search source evidence")
    .fill("no-such-source-phrase");
  await expect(
    panel.getByText("No source segments match.", { exact: false }),
  ).toBeVisible();
  await panel.getByLabel("Search source evidence").fill("");
  await panel
    .getByLabel("Evidence verification filter")
    .selectOption("unchecked");
  await expect(
    panel.getByRole("button", { name: "Confirm selected evidence" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel
    .getByRole("button", { name: "Expand evidence workspace" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Source evidence workspace" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".planning/screenshots/evidence-workspace-mobile.png",
  });
});

test("map markers follow the sourced list and manual observations remain distinct", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  const place = { name: "Pune, Maharashtra", lat: 18.52, lon: 73.85 };
  let context: any = {
    place,
    category: "food",
    radius: 1000,
    revision: 1,
    observations: [],
  };
  await page.route("**/api/submissions/*/local-context", async (route) => {
    if (route.request().method() === "POST")
      context = {
        ...context,
        ...route.request().postDataJSON(),
        revision: context.revision + 1,
      };
    await route.fulfill({ json: { context } });
  });
  await page.route("**/api/locations/businesses", (route) =>
    route.fulfill({
      json: {
        status: "available",
        businesses: [
          {
            id: "node/1",
            name: "Public mapped cafe",
            category: "cafe",
            distanceMeters: 200,
            url: "https://www.openstreetmap.org/node/1",
            lat: 18.521,
            lon: 73.85,
          },
        ],
        center: place,
        radiusMeters: 1000,
        category: "food",
        retrievedAt: new Date().toISOString(),
        attribution: "© OpenStreetMap contributors",
        message: "Mapped listings are incomplete.",
      },
    }),
  );
  await page.route(
    "**/api/submissions/*/local-context/observations",
    async (route) => {
      const body = route.request().postDataJSON();
      context = {
        ...context,
        revision: context.revision + 1,
        observations: [
          { ...body, id: "manual-1", recordedAt: new Date().toISOString() },
        ],
      };
      await route.fulfill({ status: 201, json: { context } });
    },
  );
  await page.goto(`/submissions/${records[0]!.id}`);
  await page
    .getByRole("button", { name: "Find nearby similar businesses" })
    .click();
  const panel = page.locator(".location-panel");
  await expect(
    panel.getByRole("region", { name: "Nearby business map" }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Look up mapped businesses" })
    .click();
  await panel
    .getByRole("button", { name: "Show Public mapped cafe on map" })
    .click();
  await expect(panel.locator(".leaflet-popup-content")).toHaveText(
    "Public mapped cafe",
  );
  await panel
    .getByRole("button", { name: "Add sourced local observation" })
    .click();
  await panel
    .getByLabel("Observed business name")
    .fill("Sourced assessor observation");
  await panel
    .getByLabel("Public source URL")
    .fill("https://www.openstreetmap.org/node/2");
  await panel
    .getByLabel("What was observed?")
    .fill(
      "Public listing suggests this service; opening status needs checking.",
    );
  await panel.getByLabel("Observed business latitude").fill("18.5201");
  await panel.getByLabel("Observed business longitude").fill("73.8501");
  await panel.getByRole("button", { name: "Save manual observation" }).click();
  await expect(
    panel.getByText("Reported; needs checking", { exact: false }),
  ).toBeVisible();
  await expect(panel.locator(".map-business-pin.manual")).toHaveCount(1);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".planning/screenshots/business-map-desktop.png",
    fullPage: false,
  });
  await panel.getByLabel("Business category").selectOption("tailoring");
  await expect(
    panel.getByRole("button", { name: "Show Public mapped cafe on map" }),
  ).toHaveCount(0);
  await expect(panel.locator(".map-business-pin.manual")).toHaveCount(0);
});

test("map works with confirmed coordinates when geocoding is unavailable and fits mobile", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/submissions/${records[0]!.id}`);
  await page
    .getByRole("button", { name: "Find nearby similar businesses" })
    .click();
  const panel = page.locator(".location-panel");
  await panel
    .getByLabel("Business location", { exact: true })
    .fill("Confirmed Pune location");
  await panel
    .getByText("Use a confirmed map point instead", { exact: true })
    .click();
  await panel.getByLabel("Location latitude").fill("18.52");
  await panel.getByLabel("Location longitude").fill("73.85");
  await panel.getByRole("button", { name: "Confirm coordinates" }).click();
  await panel.getByLabel("Business category").selectOption("food");
  await expect(
    panel.getByRole("button", { name: "Look up mapped businesses" }),
  ).toBeEnabled();
  await expect(panel.locator(".map-center-pin")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.locator(".business-map").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".planning/screenshots/business-map-mobile.png",
  });
});

test("an assessor can assign a cohort after entrepreneur submission", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  await page.route("**/api/cohorts", (route) =>
    route.fulfill({
      json: {
        cohorts: [
          {
            id: "bbbbbbbbbbbbbbbbbbbbbbbb",
            name: "Actual programme cohort",
            synthetic: false,
          },
        ],
      },
    }),
  );
  await page.route("**/api/submissions/*/cohort", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.updatedAt).toBe(records[0]!.updatedAt);
    records[0] = {
      ...records[0]!,
      cohortId: body.cohortId,
      cohortName: "Actual programme cohort",
      updatedAt: new Date().toISOString(),
    };
    await route.fulfill({ json: { submission: records[0] } });
  });
  await page.goto(`/submissions/${records[0]!.id}`);
  await page.getByText("Assign programme cohort", { exact: true }).click();
  await page
    .getByLabel("Assign programme cohort", { exact: true })
    .selectOption("bbbbbbbbbbbbbbbbbbbbbbbb");
  await page.getByRole("button", { name: "Save cohort" }).click();
  await expect(page.locator(".detail-meta")).toContainText(
    "Actual programme cohort",
  );
});

test("assessor domain ratings collect a rationale and source references without inventing unknown ratings", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "assessor");
  await page.goto(`/submissions/${records[0]!.id}`);
  await page.getByRole("button", { name: "Add review", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByText("Rate business potential across six domains", { exact: true })
    .click();
  await expect(
    dialog.getByLabel("Clarity rating", { exact: true }),
  ).toHaveValue("");
  await dialog.getByLabel("Clarity rating", { exact: true }).selectOption("2");
  await expect(
    dialog.getByLabel("Clarity rationale", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Clarity evidence", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Market potential rating", { exact: true }),
  ).toHaveValue("");
});

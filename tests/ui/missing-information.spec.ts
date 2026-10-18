import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
import { assess } from "../../server/src/domain/assessment";
import {
  FIELD_KEYS,
  FIELD_LABELS,
  type EvidenceField,
  type SourceSegment,
} from "../../shared/types";

function assessment() {
  const segment: SourceSegment = {
    id: "s1",
    originalText: "I sell handmade bags to college students in Pune.",
    englishText: "I sell handmade bags to college students in Pune.",
    page: null,
    startSeconds: null,
    endSeconds: null,
    kind: "text",
    verified: true,
  };
  const fields: EvidenceField[] = (
    [
      ["products", "handmade bags"],
      ["customers", "college students"],
      ["location", "Pune"],
    ] as const
  ).map(([key, value]) => ({
    key,
    value,
    status: "supported",
    evidenceIds: ["s1"],
    reason: "Quoted",
  }));
  return assess({
    fields,
    segments: [segment],
    language: "English",
    providerModel: "test",
  });
}

for (const role of ["entrepreneur", "assessor"] as const) {
  test(`${role} sees a question for every missing parameter and none for extracted answers`, async ({
    page,
  }) => {
    const { records } = await mockWorkspace(page, role);
    records[0]!.assessment = assessment();
    await page.goto(`/submissions/${records[0]!.id}`);
    const panel = page.locator(".completion-panel");
    await expect(
      panel.getByRole("heading", { name: "Complete missing information" }),
    ).toBeVisible();
    await expect(panel.locator(".completion-question")).toHaveCount(
      FIELD_KEYS.length - 3,
    );
    for (const field of ["products", "customers", "location"] as const)
      await expect(
        panel.getByRole("button", {
          name: `Answer ${FIELD_LABELS[field]}`,
          exact: true,
        }),
      ).toHaveCount(0);
    for (const field of [
      "trade",
      "sector",
      "materials",
      "selfInvestment",
      "loan",
      "monthlyCosts",
    ] as const)
      await expect(
        panel.getByRole("button", {
          name: `Answer ${FIELD_LABELS[field]}`,
          exact: true,
        }),
      ).toBeVisible();
  });
}

test("saving a short answer removes only that question and continues to the remaining ones", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  records[0]!.assessment = assessment();
  let calls = 0;
  await page.route("**/api/submissions/*/clarifications", async (route) => {
    const body = route.request().postData()!;
    expect(body).toContain('name="field"\r\n\r\nselfInvestment');
    expect(body).toContain('name="answer"\r\n\r\n0');
    calls++;
    const previous = records[0]!.assessment!;
    const segment: SourceSegment = {
      id: "v2-s1",
      originalText: "0",
      englishText: "0",
      kind: "clarification",
      verified: false,
      page: null,
      startSeconds: null,
      endSeconds: null,
    };
    records[0]!.assessment = assess({
      fields: previous.fields.map((f) =>
        f.key === "selfInvestment"
          ? { ...f, value: "0", status: "supported", evidenceIds: [segment.id] }
          : f,
      ),
      segments: [...previous.segments, segment],
      language: "English",
      providerModel: "test",
      version: 2,
    });
    await route.fulfill({ json: { submission: records[0] } });
  });
  await page.goto(`/submissions/${records[0]!.id}`);
  await page
    .getByRole("button", { name: "Answer Own investment", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Information to clarify")).toHaveValue(
    "repair-1-selfInvestment",
  );
  await dialog.getByLabel("Your clarification").fill("0");
  await dialog.getByRole("button", { name: "Save & reassess" }).click();
  await expect(page.locator(".completion-question")).toHaveCount(
    FIELD_KEYS.length - 4,
  );
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator("option", { hasText: "Own investment" }),
  ).toHaveCount(0);
  await expect(dialog.getByLabel("Your clarification")).toHaveValue("");
  expect(calls).toBe(1);
});

test("a fully answered input has no follow-up fields or answer buttons", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  const segments = FIELD_KEYS.map((key, i) => ({
    id: `s${i}`,
    originalText: `${key} supplied`,
    englishText: `${key} supplied`,
    kind: "text" as const,
    verified: true,
    page: null,
    startSeconds: null,
    endSeconds: null,
  }));
  records[0]!.assessment = assess({
    fields: FIELD_KEYS.map((key, i) => ({
      key,
      value: `${key} supplied`,
      status: "supported",
      evidenceIds: [`s${i}`],
      reason: "Quoted",
    })),
    segments,
    language: "English",
    providerModel: "test",
  });
  await page.goto(`/submissions/${records[0]!.id}`);
  await expect(
    page.getByText(
      "All parameters have answers in the available evidence. No additional questions are needed.",
    ),
  ).toBeVisible();
  await expect(page.locator(".completion-question")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Resolve gaps" }),
  ).toBeDisabled();
});

test("missing questions and the answer dialog fit on mobile", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  records[0]!.assessment = assessment();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/submissions/${records[0]!.id}`);
  await expect(page.locator(".completion-question")).toHaveCount(
    FIELD_KEYS.length - 3,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Answer Monthly costs", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".planning/screenshots/missing-information-mobile.png",
    fullPage: false,
  });
});

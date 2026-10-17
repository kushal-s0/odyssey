import { test, expect } from "@playwright/test";

test("quota waiting shows a scheduled retry without a processing spinner or resubmission", async ({
  page,
}) => {
  const record = {
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    beneficiaryName: "Test Entrepreneur",
    title: "Saved business idea",
    inputType: "text",
    language: "mr-IN",
    status: "queued",
    stage: "Waiting for AI quota",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assessment: null,
    history: [],
    review: null,
    error:
      "The daily AI quota is exhausted. Your original submission is saved.",
    errorCode: "PROVIDER_DAILY_QUOTA",
    nextRetryAt: new Date(Date.now() + 7200000).toISOString(),
  };
  let writes = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST") writes++;
    const health = {
      database: true,
      gemini: true,
      sarvam: true,
      classifier: false,
      examples: false,
      maxUploadMb: 10,
      audioProvider: "sarvam",
    };
    await route.fulfill({
      json:
        path === "/api/session"
          ? {
              user: {
                id: "bbbbbbbbbbbbbbbbbbbbbbbb",
                name: "Test Entrepreneur",
                email: "test@example.test",
                role: "entrepreneur",
              },
              health,
            }
          : path === "/api/health"
            ? health
            : path === "/api/submissions"
              ? { submissions: [record] }
              : path.endsWith(record.id)
                ? { submission: record }
                : { cohorts: [], submissions: [] },
    });
  });
  await page.goto(`/submissions/${record.id}`);
  await expect(
    page.getByRole("heading", { name: "Waiting for AI service quota" }),
  ).toBeVisible();
  await expect(
    page.getByText("Next automatic attempt:", { exact: false }),
  ).toContainText("no resubmission is needed");
  await expect(page.locator(".processing-symbol .spin")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Retry processing" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".planning/screenshots/quota-waiting.png",
    fullPage: true,
  });
  expect(writes).toBe(0);
});

import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
import { assess } from "../../server/src/domain/assessment";
test("full detail asks one question at a time and keeps the full checklist and sources in popups", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  const original = records[0]!.assessment!.segments[0]!.originalText;
  records[0]!.assessment = assess({
    fields: [],
    segments: records[0]!.assessment!.segments,
    language: "English",
    providerModel: "test",
  });
  await page.goto(`/submissions/${records[0]!.id}?view=full`);
  await expect(page.locator(".completion-question")).toHaveCount(0);
  await expect(page.locator(".one-question-body h3")).toHaveCount(1);
  await expect(page.locator(".one-question-body h3")).toHaveText(
    "What is your business called?",
  );
  await page
    .getByRole("button", { name: "Next question", exact: true })
    .click();
  await expect(page.locator(".one-question-body h3")).toHaveText(
    "What work will your business do?",
  );
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await expect(page.getByLabel("Choose a question")).toHaveValue(
    "repair-1-trade",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByRole("button", { name: "All questions", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".completion-question"),
  ).toHaveCount(19);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByRole("button", { name: "Open sources", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(".source-segment").first(),
  ).toContainText(original);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.screenshot({
    path: ".planning/screenshots/questions-simple-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".planning/screenshots/questions-simple-mobile.png",
    fullPage: true,
  });
});
test("submission help is optional and page help keeps the original explanation", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  await page.goto("/submit");
  await expect(page.locator(".submit-quick-guide")).toContainText(
    "Share. Check. Improve.",
  );
  await expect(
    page.getByText(
      "Set up the business, customers, resources, and money plans",
      { exact: true },
    ),
  ).toHaveCount(0);
  await page
    .locator(".submit-quick-guide")
    .getByRole("button", { name: "How it works", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Set up the business, customers, resources, and money plans",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .getByRole("button", { name: "About this page", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("recording controls never submit the form when recording again", async ({
  page,
}) => {
  await mockWorkspace(page, "entrepreneur");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }),
      },
      configurable: true,
    });
    class TestRecorder {
      static isTypeSupported() {
        return true;
      }
      mimeType = "audio/webm";
      state = "inactive";
      ondataavailable: any;
      onstop: any;
      constructor(..._args: any[]) {}
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["fictional speech fixture"]),
        });
        this.onstop?.();
      }
    }
    (window as any).MediaRecorder = TestRecorder;
  });
  await page.goto("/submit");
  await page
    .getByRole("button", { name: "Record or upload", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  const again = page.getByRole("button", { name: "Record again", exact: true });
  await expect(again).toHaveAttribute("type", "button");
  await again.click();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("printing from the simple view retains full original sources and missing questions", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  await page.goto(`/submissions/${records[0]!.id}`);
  await expect(page.locator(".assessment-print-report")).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".assessment-print-report")).toBeVisible();
  await expect(page.locator(".assessment-print-report")).toContainText(
    records[0]!.assessment!.segments[0]!.originalText,
  );
  await expect(page.locator(".idea-visualizer")).toBeHidden();
});

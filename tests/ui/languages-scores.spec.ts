import { test, expect } from "@playwright/test";
import { mockWorkspace } from "./fixtures";
import { readFileSync } from "node:fs";
const hi = JSON.parse(
  readFileSync(
    new URL("../../client/src/locales/hi.json", import.meta.url),
    "utf8",
  ),
);

test("language changes preserve the intake draft and input language while using bundled UI copy", async ({
  page,
}) => {
  const { requests } = await mockWorkspace(page, "entrepreneur");
  await page.goto("/submit");
  const draft = page.locator("textarea").first();
  await draft.fill(
    "My original business statement must stay exactly as entered.",
  );
  const language = page.getByRole("combobox", { name: "Website language" });
  await language.selectOption("hi-IN");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
  await expect(draft).toHaveValue(
    "My original business statement must stay exactly as entered.",
  );
  await expect(
    page.getByRole("link", { name: hi["My dashboard"] }),
  ).toBeVisible();
  expect(
    requests.filter((p) => /translate|generate|clarifications/.test(p)),
  ).toEqual([]);
  await page.reload();
  await expect(language).toHaveValue("hi-IN");
  await language.selectOption("en-IN");
  await expect(page.getByRole("link", { name: "My dashboard" })).toBeVisible();
});

test("score explanation reconciles weighted points and leaves source quotations unchanged in every language", async ({
  page,
}) => {
  const { records } = await mockWorkspace(page, "entrepreneur");
  const original = records[0]!.assessment!.segments[0]!.originalText;
  await page.goto(`/submissions/${records[0]!.id}?view=full`);
  const score = page.locator(".score-explanation");
  await score.locator(":scope > summary").click();
  await score.locator("details > summary").click();
  await expect(score).toContainText("75/100");
  const a = records[0]!.assessment!;
  const weighted = a.dimensions
    .filter((d) => d.weight > 0)
    .reduce((sum, d) => sum + ((d.score ?? 0) / 4) * d.weight, 0);
  await expect(score.locator(".score-formula")).toContainText(
    weighted.toFixed(2),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  for (const code of ["hi-IN", "mr-IN", "te-IN", "bn-IN", "od-IN", "en-IN"]) {
    await page
      .getByRole("combobox", { name: "Website language" })
      .selectOption(code);
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      code === "od-IN" ? "or-IN" : code,
    );
    await expect(score.locator(".score-explanation-total")).toContainText(
      String(a.score),
    );
    await page.locator(".source-launcher button").click();
    await expect(page.locator(".source-segment").first()).toContainText(original);
    await page.getByRole("dialog").locator(".modal-heading button").first().click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Open sources", exact: true }).click();
  await expect(page.locator(".source-segment").first()).toContainText(original);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await score.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".planning/screenshots/score-explanation-mobile.png",
    fullPage: false,
  });
});

test("public language selector covers all six input languages and translates authentication", async ({
  page,
}) => {
  await mockWorkspace(page, null);
  await page.goto("/");
  const language = page.getByRole("combobox", { name: "Website language" });
  await expect(language.locator("option")).toHaveCount(6);
  for (const code of ["hi-IN", "mr-IN", "te-IN", "bn-IN", "od-IN"]) {
    await language.selectOption(code);
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      code === "od-IN" ? "or-IN" : code,
    );
    await expect(page.getByRole("heading").first()).not.toContainText(
      "Your business idea.",
    );
  }
  await page.goto("/login");
  await expect(language).toHaveValue("od-IN");
  await expect(page.getByRole("heading").last()).not.toContainText(
    "Sign in to your workspace.",
  );
});

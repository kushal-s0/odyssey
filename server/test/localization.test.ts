import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FIELD_KEYS } from "../../shared/types.js";
import { PARAMETER_QUESTIONS } from "../../shared/repair-questions.js";
import { fixedQuestionTranslations } from "../../shared/localized-questions.js";
import { translateQuestions } from "../src/providers/gemini.js";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("all supported regional input languages translate fixed follow-up questions without hosted calls", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("No provider should be used");
  };
  const questions = FIELD_KEYS.map((field) => ({
    id: field,
    question: PARAMETER_QUESTIONS[field].question,
  }));
  for (const language of [
    "Hindi",
    "Marathi",
    "Telugu",
    "Bengali",
    "Odia",
    "hi-IN",
    "mr-IN",
    "te-IN",
    "bn-IN",
    "od-IN",
  ]) {
    const result = await translateQuestions(questions, language);
    assert.equal(result.length, 19, language);
    assert.deepEqual(
      result.map((q) => q.id),
      FIELD_KEYS,
    );
    assert.ok(
      result.every(
        (q) =>
          q.translation.trim() &&
          q.translation !==
            questions.find((original) => original.id === q.id)?.question,
      ),
    );
  }
  assert.equal(calls, 0);
  const conflict = fixedQuestionTranslations(
    [
      {
        id: "investment",
        question:
          "The input contains conflicting or unclear answers. Please confirm: " +
          PARAMETER_QUESTIONS.investment.question,
      },
    ],
    "Hindi",
  );
  assert.equal(conflict?.length, 1);
  assert.ok(!conflict?.[0]?.translation.includes("Please confirm"));
});

test("bundled regional catalogues cover every static UI key and preserve placeholders", async () => {
  const root = new URL("../../client/src/locales/", import.meta.url);
  const base = JSON.parse(await readFile(new URL("en.json", root), "utf8"));
  const tokens = (s: string) =>
    [...s.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
  for (const language of ["hi", "mr", "te", "bn", "od"]) {
    const catalog = JSON.parse(
      await readFile(new URL(`${language}.json`, root), "utf8"),
    );
    for (const text of Object.keys(base)) {
      assert.ok(catalog[text]?.trim(), `${language}: ${text}`);
      assert.deepEqual(
        tokens(catalog[text]),
        tokens(text),
        `${language}: ${text}`,
      );
    }
  }
});

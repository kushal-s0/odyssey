import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { readSource, extractFields } from "../src/providers/gemini.js";
const originalFetch = globalThis.fetch,
  originalKey = config.GEMINI_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  config.GEMINI_API_KEY = originalKey;
});
function respond(data: unknown, finishReason = "STOP") {
  config.GEMINI_API_KEY = "unit-test-only-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason,
            content: { parts: [{ text: JSON.stringify(data) }] },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
}
const segment = (
  originalText: string,
  englishText = originalText,
  page: number | null = null,
) => ({
  originalText,
  englishText,
  page,
  startSeconds: null,
  endSeconds: null,
});
test("manufactured original text is withheld even when structured output is valid", async () => {
  respond({
    language: "English",
    segments: [segment("I earn Rs. 90,000 monthly.")],
  });
  await assert.rejects(
    () =>
      readSource({
        text: "I have no revenue estimate.",
        kind: "text",
        language: "en-IN",
      }),
    /No reliable business content/,
  );
});
test("invalid PDF page references do not become evidence", async () => {
  respond({ language: "Hindi", segments: [segment("कपड़े", "Clothes", 99)] });
  await assert.rejects(
    () =>
      readSource({
        buffer: Buffer.from("%PDF-test"),
        mime: "application/pdf",
        kind: "pdf",
        language: "hi-IN",
        pageCount: 2,
      }),
    /No reliable business content/,
  );
});
test("numeric drift in translation is withheld and the original survives", async () => {
  const original = "मासिक बिक्री ४५,००० रुपये";
  respond({
    language: "Hindi",
    segments: [segment(original, "Monthly sales are Rs. 90,000")],
  });
  const result = await readSource({
    text: original,
    kind: "text",
    language: "hi-IN",
  });
  assert.equal(result.segments[0]?.englishText, original);
  assert.equal(result.segments[0]?.verified, false);
  assert.ok(result.warnings.some((w) => w.includes("numeric")));
});
test("native numeral normalization permits faithful numeric translation", async () => {
  const original = "मासिक बिक्री ४५,००० रुपये";
  respond({
    language: "Hindi",
    segments: [segment(original, "Monthly sales are Rs. 45,000")],
  });
  const result = await readSource({
    text: original,
    kind: "text",
    language: "hi-IN",
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.segments[0]?.verified, false);
});
test("incomplete generation never publishes a partial assessment", async () => {
  respond(
    { language: "English", segments: [segment("A tailoring business.")] },
    "MAX_TOKENS",
  );
  await assert.rejects(
    () =>
      readSource({
        text: "A tailoring business.",
        kind: "text",
        language: "en-IN",
      }),
    /blocked or incomplete/,
  );
});
test("hosted extraction validates its output schema", async () => {
  respond({
    fields: [
      {
        key: "invented_field",
        value: "Guaranteed success",
        status: "supported",
        evidenceIds: [],
        reason: "",
      },
    ],
  });
  await assert.rejects(() => extractFields([]));
});

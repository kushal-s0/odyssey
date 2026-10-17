import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import {
  buildAssessment,
  type ProcessingCheckpoint,
} from "../src/processing.js";
import { generationGate, embeddingGate } from "../src/providers/quota.js";

const original = {
  fetch: globalThis.fetch,
  key: config.GEMINI_API_KEY,
  interval: config.GEMINI_MIN_REQUEST_INTERVAL_MS,
  classifier: config.MODEL_SERVICE_URL,
  groq: config.GROQ_API_KEY,
};
afterEach(() => {
  globalThis.fetch = original.fetch;
  config.GEMINI_API_KEY = original.key;
  config.GEMINI_MIN_REQUEST_INTERVAL_MS = original.interval;
  config.MODEL_SERVICE_URL = original.classifier;
  config.GROQ_API_KEY = original.groq;
  generationGate.reset();
  embeddingGate.reset();
});
const source = {
  language: "English",
  segments: [
    {
      originalText: "Artificial test business.",
      englishText: "Artificial test business.",
      page: null,
      startSeconds: null,
      endSeconds: null,
    },
  ],
};
const generated = (value: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: JSON.stringify(value) }] },
        },
      ],
    }),
  );
test("a retry reuses validated source evidence and invalidates it when the input changes", async () => {
  config.GEMINI_API_KEY = "test-only";
  config.GROQ_API_KEY = "";
  config.GEMINI_MIN_REQUEST_INTERVAL_MS = 0;
  config.MODEL_SERVICE_URL = "";
  let checkpoint: ProcessingCheckpoint | undefined;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return generated(source);
    return new Response(
      JSON.stringify({ error: { details: [{ retryDelay: "60s" }] } }),
      { status: 429 },
    );
  };
  const input = {
    kind: "text" as const,
    language: "en-IN",
    text: "Artificial test business.",
    onCheckpoint: (value: ProcessingCheckpoint) => {
      checkpoint = structuredClone(value);
    },
  };
  await assert.rejects(() => buildAssessment(input), /rate limited/);
  assert.equal(calls, 2);
  assert.ok(checkpoint?.source?.segments.length);
  generationGate.reset();
  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return generated({ fields: [] });
  };
  const result = await buildAssessment({ ...input, checkpoint });
  assert.equal(
    calls,
    1,
    "only extraction is retried; source reading is not uploaded again",
  );
  assert.equal(
    result.assessment.score,
    null,
    "missing evidence still produces no score",
  );
  assert.ok(checkpoint?.fields);
  generationGate.reset();
  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return generated({
      ...source,
      segments: [
        {
          ...source.segments[0],
          originalText: "Changed artificial test business.",
          englishText: "Changed artificial test business.",
        },
      ],
    });
  };
  await assert.rejects(() =>
    buildAssessment({
      ...input,
      text: "Changed artificial test business.",
      checkpoint,
    }),
  );
  assert.equal(calls, 2, "changed source must be read again before extraction");
});

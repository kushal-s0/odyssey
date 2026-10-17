import { test } from "node:test";
import assert from "node:assert/strict";
import { artifactSchema } from "../src/model.js";
import { createModelApp } from "../src/app.js";
test("untrained remote service is explicit and protects its inference route", async () => {
  const app = createModelApp(
    null,
    "test-service-token-with-at-least-32-characters",
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port.");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${base}/health`);
    assert.equal(((await health.json()) as any).ready, false);
    const unauthorized = await fetch(`${base}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(unauthorized.status, 401);
    const untrained = await fetch(`${base}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-service-token-with-at-least-32-characters",
      },
      body: "{}",
    });
    assert.equal(untrained.status, 503);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
test("rejects a model artefact whose coefficients do not match its dimension", () => {
  assert.equal(
    artifactSchema.safeParse({
      format: "strive-relevance-v1",
      modelVersion: "invalid",
      featureVersion: "context-question-answer-v1",
      embeddingModel: "test",
      dimension: 768,
      coefficients: [],
      intercept: 0,
      classes: [0, 1],
      trainingDataHash: "test",
      trainedAt: "test",
      metrics: {},
      advisoryOnly: true,
    }).success,
    false,
  );
});

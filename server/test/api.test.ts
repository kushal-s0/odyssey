import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
let server: Server, base: string;
before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port.");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
});
test("health exposes configuration status without secrets", async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  const data: any = await r.json();
  assert.equal(data.database, false);
  assert.equal("GEMINI_API_KEY" in data, false);
  assert.match(r.headers.get("cache-control") ?? "", /no-store/);
});
test("example data is explicit and does not pretend to be actual model results", async () => {
  const r = await fetch(`${base}/api/examples`);
  assert.equal(r.status, 200);
  const data: any = await r.json();
  assert.equal(data.submissions.length, 8);
  assert.ok(data.submissions.every((s: any) => s.example && s.cohortSynthetic));
  assert.ok(
    data.submissions.every((s: any) =>
      s.assessment.providerModel.includes("Illustrative"),
    ),
  );
  assert.equal(
    data.submissions.find((s: any) => s.id === "example-poultry").assessment
      .score,
    null,
  );
});
test("unconfigured Atlas never silently falls back to a writable local database", async () => {
  const r = await fetch(`${base}/api/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Demo" }),
  });
  assert.equal(r.status, 503);
  assert.equal(((await r.json()) as any).code, "DATABASE_NOT_CONFIGURED");
});
test("original source files require assessor access", async () => {
  const r = await fetch(
    `${base}/api/submissions/507f1f77bcf86cd799439011/source`,
  );
  assert.equal(r.status, 503);
  assert.match(((await r.json()) as any).error, /Atlas/);
});
test("cross-origin mutations are rejected before reaching storage", async () => {
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://unrelated.invalid",
    },
    body: JSON.stringify({
      email: "assessor@example.com",
      password: "irrelevant",
    }),
  });
  assert.equal(r.status, 403);
});

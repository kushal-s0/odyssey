import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { developmentApiTarget } from "../../shared/dev-config.js";
import { waitForDevelopmentApi } from "../src/dev-readiness.js";

test("development proxy and startup checks use the configured API port", () => {
  assert.equal(developmentApiTarget({}), "http://127.0.0.1:4000");
  assert.equal(developmentApiTarget({ PORT: "4219" }), "http://127.0.0.1:4219");
  for (const PORT of ["bad", "0", "65536", "4000.5"])
    assert.throws(() => developmentApiTarget({ PORT }), /PORT/);
});

test("development startup waits for API liveness independently of Atlas readiness", async () => {
  let requests = 0;
  const server = createServer((_req, res) => {
    const ready = ++requests >= 3;
    res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: ready ? "live" : "starting", database: false }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await waitForDevelopmentApi(`http://127.0.0.1:${address.port}`, {
      timeoutMs: 2000,
      intervalMs: 1,
    });
    assert.equal(requests, 3);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("an unrelated listener cannot silently satisfy the development startup check", async () => {
  const server = createServer((_req, res) =>
    res.end(JSON.stringify({ status: "unrelated" })),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await assert.rejects(
      waitForDevelopmentApi(`http://127.0.0.1:${address.port}`, {
        timeoutMs: 30,
        intervalMs: 1,
      }),
      /API did not start/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

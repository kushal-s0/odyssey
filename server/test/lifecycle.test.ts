import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { gracefulShutdown } from "../src/lifecycle.js";
test("shutdown stops claiming work, drains accepted jobs and disconnects storage", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const events: string[] = [];
  const drained = await gracefulShutdown(server, {
    stop: () => {
      events.push("stop");
    },
    drain: async () => {
      events.push("drain");
    },
    disconnect: async () => {
      events.push("disconnect");
    },
  });
  assert.equal(drained, true);
  assert.deepEqual(events, ["stop", "drain", "disconnect"]);
  assert.equal(server.listening, false);
});
test("shutdown has a deadline when a provider request does not finish", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let disconnected = false;
  const drained = await gracefulShutdown(
    server,
    {
      stop: () => {},
      drain: () => new Promise(() => {}),
      disconnect: async () => {
        disconnected = true;
      },
    },
    15,
  );
  assert.equal(drained, false);
  assert.equal(disconnected, true);
  assert.equal(server.listening, false);
});

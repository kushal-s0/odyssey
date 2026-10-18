import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startConnectionRetry,
  databaseFailureCode,
} from "../src/connection-retry.js";

test("initial database failures retry serially with capped backoff and initialize after recovery", async () => {
  let attempts = 0,
    active = 0,
    initialized = 0;
  const delays: number[] = [];
  let ready!: () => void;
  const recovered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const connection = startConnectionRetry({
    initialDelayMs: 1,
    maxDelayMs: 2,
    connect: async () => {
      active++;
      assert.equal(active, 1);
      await Promise.resolve();
      active--;
      if (++attempts <= 3) throw new Error("Unavailable");
      return true;
    },
    initialize: async () => {
      initialized++;
      ready();
    },
    onFailure: (_error, delay) => {
      delays.push(delay);
    },
  });
  try {
    await recovered;
    await connection.drain();
    assert.equal(attempts, 4);
    assert.equal(initialized, 1);
    assert.deepEqual(delays, [1, 2, 2]);
  } finally {
    connection.stop();
  }
});

test("stopping during a connection attempt prevents worker initialization and retries", async () => {
  let resolveConnect!: (connected: boolean) => void;
  let initialized = false,
    failed = false;
  const connection = startConnectionRetry({
    connect: () =>
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    initialize: async () => {
      initialized = true;
    },
    onFailure: () => {
      failed = true;
    },
  });
  connection.stop();
  resolveConnect(true);
  await connection.drain();
  assert.equal(initialized, false);
  assert.equal(failed, false);
});

test("initialization failure retries, and an unconfigured connection does not initialize", async () => {
  let count = 0;
  let ready!: () => void;
  const recovered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const connection = startConnectionRetry({
    initialDelayMs: 1,
    connect: async () => true,
    initialize: async () => {
      if (++count === 1) throw new Error();
      ready();
    },
    onFailure: () => {},
  });
  try {
    await recovered;
    await connection.drain();
    assert.equal(count, 2);
  } finally {
    connection.stop();
  }
  const absent = startConnectionRetry({
    connect: async () => false,
    initialize: async () => {
      assert.fail("No database configured");
    },
    onFailure: () => {
      assert.fail("No failed network attempt");
    },
  });
  await absent.drain();
  absent.stop();
});

test("database diagnostics classify nested causes without revealing raw connection errors", () => {
  const error = {
    message: "mongodb+srv://secret:password@private-host",
    reason: {
      servers: new Map([
        ["private-host", { error: { cause: { code: "ECONNRESET" } } }],
      ]),
    },
  };
  assert.equal(databaseFailureCode(error), "DATABASE_NETWORK_FAILED");
  assert.equal(
    databaseFailureCode({ code: 18 }),
    "DATABASE_AUTHENTICATION_FAILED",
  );
  assert.equal(
    databaseFailureCode({ cause: { code: "ENOTFOUND" } }),
    "DATABASE_DNS_FAILED",
  );
  assert.equal(
    databaseFailureCode(new Error("secret")),
    "DATABASE_INITIALIZATION_FAILED",
  );
});

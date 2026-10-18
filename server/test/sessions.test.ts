import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { digest } from "../src/auth.js";
import { config } from "../src/config.js";
import { SessionModel, UserModel } from "../src/db.js";
const first = "111111111111111111111111",
  second = "222222222222222222222222";
let server: Server, base: string, passwordHash: string;
const original = {
  state: mongoose.connection.readyState,
  findSession: SessionModel.findOne,
  createSession: SessionModel.create,
  deleteSession: SessionModel.deleteOne,
  deleteSessions: SessionModel.deleteMany,
  findUser: UserModel.findById,
  findByEmail: UserModel.findOne,
  updateUser: UserModel.findOneAndUpdate,
  updateUserById: UserModel.findByIdAndUpdate,
};
let users: Map<string, any>, sessions: Map<string, any>;
const query = (value: any) => ({
  select: () => query(value),
  lean: async () => value,
});
function seed(
  token: string,
  userId = first,
  version: number | undefined = 0,
  expired = false,
) {
  sessions.set(digest(token), {
    tokenHash: digest(token),
    userId,
    sessionVersion: version,
    expiresAt: new Date(Date.now() + (expired ? -1000 : 3600000)),
  });
}
before(async () => {
  passwordHash = await bcrypt.hash("original-test-password", 4);
  mongoose.connection.readyState = 1;
  SessionModel.findOne = ((filter: any) =>
    query(
      [...sessions.values()].find(
        (s) =>
          s.tokenHash === filter.tokenHash &&
          s.expiresAt > filter.expiresAt.$gt,
      ) ?? null,
    )) as any;
  SessionModel.create = (async (value: any) => {
    sessions.set(value.tokenHash, value);
    return value;
  }) as any;
  SessionModel.deleteOne = (async (filter: any) => ({
    deletedCount: sessions.delete(filter.tokenHash) ? 1 : 0,
  })) as any;
  SessionModel.deleteMany = (async (filter: any) => {
    let deletedCount = 0;
    for (const [key, session] of sessions) {
      if (
        String(session.userId) === String(filter.userId) &&
        (session.sessionVersion === undefined ||
          session.sessionVersion < filter.$or[0].sessionVersion.$lt)
      ) {
        sessions.delete(key);
        deletedCount++;
      }
    }
    return { deletedCount };
  }) as any;
  UserModel.findById = ((id: any) =>
    query(users.get(String(id)) ?? null)) as any;
  UserModel.findOne = (async (filter: any) =>
    [...users.values()].find((user) => user.email === filter.email) ??
    null) as any;
  const update = (filter: any, changes: any) => {
    const user = users.get(String(filter._id));
    if (
      !user ||
      (filter.passwordHash && filter.passwordHash !== user.passwordHash)
    )
      return query(null);
    Object.assign(user, changes.$set ?? {});
    user.sessionVersion += changes.$inc?.sessionVersion ?? 0;
    return query({ ...user });
  };
  UserModel.findOneAndUpdate = ((filter: any, changes: any) =>
    update(filter, changes)) as any;
  UserModel.findByIdAndUpdate = ((id: any, changes: any) =>
    update({ _id: id }, changes)) as any;
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  base = `http://127.0.0.1:${address.port}/api`;
});
beforeEach(() => {
  mongoose.connection.readyState = 1;
  users = new Map([
    [
      first,
      {
        _id: first,
        name: "First user",
        email: "first@example.test",
        passwordHash,
        role: "entrepreneur",
        sessionVersion: 0,
      },
    ],
    [
      second,
      {
        _id: second,
        name: "Second user",
        email: "second@example.test",
        passwordHash,
        role: "entrepreneur",
        sessionVersion: 0,
      },
    ],
  ]);
  sessions = new Map();
  seed("current");
  seed("sibling");
  seed("other", second);
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  mongoose.connection.readyState = original.state;
  SessionModel.findOne = original.findSession;
  SessionModel.create = original.createSession;
  SessionModel.deleteOne = original.deleteSession;
  SessionModel.deleteMany = original.deleteSessions;
  UserModel.findById = original.findUser;
  UserModel.findOne = original.findByEmail;
  UserModel.findOneAndUpdate = original.updateUser;
  UserModel.findByIdAndUpdate = original.updateUserById;
});
const request = (path: string, token?: string, body?: unknown) =>
  fetch(base + path, {
    method: body !== undefined ? "POST" : "GET",
    headers: {
      ...(token ? { Cookie: `strive_session=${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const userFor = async (token: string) =>
  ((await (await request("/session", token)).json()) as any).user;
test("sign-out revokes only the current cookie and clears it with matching attributes", async () => {
  const response = await request("/auth/logout", "current", {});
  assert.equal(response.status, 200);
  assert.equal(await userFor("current"), null);
  assert.ok(await userFor("sibling"));
  assert.ok(await userFor("other"));
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.equal(
    (await request("/auth/logout", "current", {})).status,
    200,
    "logout is idempotent",
  );
});
test("sign out all devices ignores forged user IDs and invalidates old versions", async () => {
  const response = await request("/auth/logout-all", "current", {
    userId: second,
  });
  assert.equal(response.status, 200);
  assert.equal(await userFor("current"), null);
  assert.equal(await userFor("sibling"), null);
  assert.ok(await userFor("other"));
  // Even a session written late by a racing login with the previous version is rejected.
  seed("late-old-login", first, 0);
  assert.equal(await userFor("late-old-login"), null);
  seed("fresh-login", first, 1);
  assert.ok(await userFor("fresh-login"));
});
test("expired and version-revoked sessions fail independently of TTL cleanup", async () => {
  seed("expired", first, 0, true);
  assert.equal(await userFor("expired"), null);
  users.get(first).sessionVersion = 1;
  assert.equal(await userFor("sibling"), null);
  seed("legacy", first, undefined);
  assert.equal(await userFor("legacy"), null);
});
test("version revocation remains effective if expired-session cleanup fails", async () => {
  const cleanup = SessionModel.deleteMany;
  SessionModel.deleteMany = (async () => {
    throw new Error("simulated cleanup outage");
  }) as any;
  try {
    assert.equal(
      (await request("/auth/logout-all", "current", {})).status,
      200,
    );
    assert.ok(
      sessions.has(digest("sibling")),
      "the stale row intentionally remains in storage",
    );
    assert.equal(await userFor("sibling"), null);
    assert.ok(await userFor("other"));
  } finally {
    SessionModel.deleteMany = cleanup;
  }
});
test("logging in rotates the current cookie without logging out other devices", async () => {
  const response = await request("/auth/login", "current", {
    email: "first@example.test",
    password: "original-test-password",
  });
  assert.equal(response.status, 200);
  assert.equal(await userFor("current"), null);
  assert.ok(await userFor("sibling"));
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /strive_session=[a-f0-9]{64};/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const token = /strive_session=([^;]+)/.exec(cookie)![1]!;
  assert.ok(await userFor(token));
  const body = (await response.json()) as any;
  assert.equal("passwordHash" in body.user, false);
  assert.equal("sessionVersion" in body.user, false);
});
test("password change checks the current password and revokes all prior sessions", async () => {
  const invalid = await request("/auth/password", "current", {
    currentPassword: "incorrect-current-password",
    newPassword: "new-long-test-password",
  });
  assert.equal(invalid.status, 400);
  assert.ok(await userFor("current"));
  const response = await request("/auth/password", "current", {
    currentPassword: "original-test-password",
    newPassword: "new-long-test-password",
  });
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as any).signInRequired, true);
  assert.equal(await userFor("current"), null);
  assert.equal(await userFor("sibling"), null);
  assert.ok(await userFor("other"));
  assert.equal(
    await bcrypt.compare(
      "new-long-test-password",
      users.get(first).passwordHash,
    ),
    true,
  );
  assert.equal(
    (
      await request("/auth/login", undefined, {
        email: "first@example.test",
        password: "original-test-password",
      })
    ).status,
    401,
  );
});
test("session mutations require authentication and reject mass assignment", async () => {
  assert.equal((await request("/auth/logout-all", undefined, {})).status, 401);
  assert.equal(
    (
      await request("/auth/password", "current", {
        currentPassword: "original-test-password",
        newPassword: "new-long-test-password",
        role: "assessor",
      })
    ).status,
    400,
  );
});
test("database outages do not falsely confirm revocation of an existing cookie", async () => {
  mongoose.connection.readyState = 0;
  const response = await request("/auth/logout", "current", {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal((await request("/auth/logout", undefined, {})).status, 200);
});

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import { digest } from "../src/auth.js";
import { config } from "../src/config.js";
import { assess } from "../src/domain/assessment.js";
import {
  SessionModel,
  SubmissionModel,
  UserModel,
  ClarificationModel,
} from "../src/db.js";

let server: Server, base: string;
const owner = "111111111111111111111111",
  other = "222222222222222222222222",
  assessor = "333333333333333333333333";
const recordId = "444444444444444444444444";
const original = {
  state: mongoose.connection.readyState,
  session: SessionModel.findOne,
  user: UserModel.findById,
  record: SubmissionModel.findOne,
  records: SubmissionModel.find,
  aggregate: SubmissionModel.aggregate,
  exists: SubmissionModel.exists,
  clarification: ClarificationModel.findOne,
};
const actors = {
  owner: {
    _id: owner,
    name: "First Entrepreneur",
    email: "owner@example.test",
    role: "entrepreneur",
  },
  other: {
    _id: other,
    name: "Second Entrepreneur",
    email: "other@example.test",
    role: "entrepreneur",
  },
  assessor: {
    _id: assessor,
    name: "Test Assessor",
    email: "assessor@example.test",
    role: "assessor",
  },
};
const record = {
  _id: new mongoose.Types.ObjectId(recordId),
  ownerId: owner,
  beneficiaryName: "First Entrepreneur",
  title: "Owned idea",
  inputType: "text",
  status: "needs_review",
  stage: "Assessment complete",
  createdAt: new Date(),
  updatedAt: new Date(),
  originalText: "Original business evidence.",
  history: [],
};
function allowed(filter: any) {
  return (
    (!filter.ownerId || filter.ownerId === owner) &&
    (!filter._id || String(filter._id) === recordId)
  );
}
before(async () => {
  mongoose.connection.readyState = 1;
  SessionModel.findOne = ((query: any) => ({
    lean: async () => {
      const actor = Object.entries(actors).find(
        ([token]) => query.tokenHash === digest(token),
      );
      return actor ? { userId: actor[1]._id } : null;
    },
  })) as any;
  UserModel.findById = ((id: string) => ({
    lean: async () =>
      Object.values(actors).find((actor) => actor._id === String(id)) ?? null,
  })) as any;
  SubmissionModel.findOne = (async (filter: any) =>
    allowed(filter) ? record : null) as any;
  SubmissionModel.exists = (async (filter: any) =>
    allowed(filter) ? { _id: record._id } : null) as any;
  SubmissionModel.find = ((filter: any) => {
    const chain: any = {
      sort: () => chain,
      limit: () => chain,
      select: () => chain,
      lean: async () => (allowed(filter) ? [record] : []),
    };
    return chain;
  }) as any;
  SubmissionModel.aggregate = (async (pipeline: any[]) => {
    const owns = allowed(pipeline[0].$match);
    return [
      {
        totals: owns
          ? [
              {
                total: 1,
                processing: 0,
                assessed: 1,
                awaitingReview: 1,
                needsClarification: 1,
                failed: 0,
                meanScore: 60,
              },
            ]
          : [],
        latest: owns ? [{ _id: recordId, score: 60, completeness: 75 }] : [],
      },
    ];
  }) as any;
  ClarificationModel.findOne = (async () => {
    throw new Error(
      "Foreign clarification should be rejected before source lookup.",
    );
  }) as any;
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port.");
  base = `http://127.0.0.1:${address.port}/api`;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  SessionModel.findOne = original.session;
  UserModel.findById = original.user;
  SubmissionModel.findOne = original.record;
  SubmissionModel.find = original.records;
  SubmissionModel.aggregate = original.aggregate;
  SubmissionModel.exists = original.exists;
  ClarificationModel.findOne = original.clarification;
  mongoose.connection.readyState = original.state;
});
const headers = (token: string) => ({
  Cookie: `strive_session=${token}`,
  "Content-Type": "application/json",
});
test("entrepreneurs see only their own records while assessors see programme records", async () => {
  for (const [token, count] of [
    ["owner", 1],
    ["other", 0],
    ["assessor", 1],
  ] as const) {
    const response = await fetch(base + "/submissions", {
      headers: headers(token),
    });
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as any).submissions.length, count);
  }
});
test("dashboard aggregates are account scoped and ignore forged owner filters", async () => {
  for (const [token, total, scope] of [
    ["owner", 1, "personal"],
    ["other", 0, "personal"],
    ["assessor", 1, "programme"],
  ] as const) {
    const response = await fetch(base + `/dashboard?ownerId=${owner}`, {
      headers: headers(token),
    });
    assert.equal(response.status, 200);
    const { summary } = (await response.json()) as any;
    assert.equal(summary.scope, scope);
    assert.equal(summary.total, total);
    assert.equal(summary.latestScore, total ? 60 : null);
    assert.equal(summary.latestSubmissionId, total ? recordId : null);
    assert.equal("ownerId" in summary, false);
  }
  assert.equal((await fetch(base + "/dashboard")).status, 401);
});
test("foreign records and original files are hidden even when an entrepreneur knows the IDs", async () => {
  for (const path of [
    `/submissions/${recordId}`,
    `/submissions/${recordId}/source`,
    `/submissions/${recordId}/clarifications/555555555555555555555555/source`,
  ]) {
    assert.equal(
      (await fetch(base + path, { headers: headers("other") })).status,
      404,
    );
  }
  assert.equal(
    (
      await fetch(base + `/submissions/${recordId}`, {
        headers: headers("owner"),
      })
    ).status,
    200,
  );
});
test("entrepreneurs cannot review, verify, compare others, manage cohorts, or read training labels", async () => {
  for (const [path, method] of [
    ["/training/annotations", "GET"],
    ["/training/model", "GET"],
    ["/cohorts", "GET"],
    ["/cohorts", "POST"],
    [`/submissions/${recordId}/review`, "POST"],
    [`/submissions/${recordId}/verify`, "POST"],
    [`/submissions/${recordId}/similar`, "GET"],
    [`/submissions/${recordId}/decision-support`, "GET"],
    ["/locations/search?q=Pune", "GET"],
    ["/locations/businesses", "POST"],
  ]) {
    const response = await fetch(base + path, {
      method,
      headers: headers("owner"),
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    assert.equal(response.status, 403, path);
  }
});

test("assessor decision support uses the current assessment and does not disclose an invented risk score", async () => {
  (record as any).assessment = assess({
    fields: [],
    segments: [],
    language: "English",
    providerModel: "test",
    version: 3,
  });
  try {
    const response = await fetch(
      `${base}/submissions/${recordId}/decision-support`,
      { headers: headers("assessor") },
    );
    assert.equal(response.status, 200);
    const data: any = await response.json();
    assert.equal(data.support.assessmentVersion, 3);
    assert.equal(data.support.risk.score, null);
    assert.equal(data.support.risk.coverage, 0);
    assert.equal("ownerId" in data.support, false);
  } finally {
    delete (record as any).assessment;
  }
});
test("forged signup roles and ownership are rejected before they can write to the database", async () => {
  const signup = await fetch(base + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Name",
      email: "test@example.test",
      password: "long-test-passphrase",
      role: "assessor",
    }),
  });
  assert.equal(signup.status, 400);
  const create = await fetch(base + "/submissions", {
    method: "POST",
    headers: headers("owner"),
    body: JSON.stringify({
      beneficiaryName: "First Entrepreneur",
      title: "Test idea",
      inputType: "text",
      originalText: "This source describes a business idea.",
      ownerId: other,
    }),
  });
  assert.equal(create.status, 400);
});
test("public registration cannot reserve the configured assessor email", async () => {
  const response = await fetch(base + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Not An Assessor",
      email: config.ASSESSOR_EMAIL,
      password: "long-test-passphrase",
    }),
  });
  assert.equal(response.status, 400);
  assert.match(((await response.json()) as any).error, /reserved/);
});

import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { assess } from "../src/domain/assessment.js";
import {
  SessionModel,
  UserModel,
  SubmissionModel,
  ClarificationModel,
  AuditModel,
} from "../src/db.js";
import { generationGate } from "../src/providers/quota.js";

const originalFetch = globalThis.fetch;
const originalState = mongoose.connection.readyState;
const originalConfig = {
  key: config.GEMINI_API_KEY,
  groq: config.GROQ_API_KEY,
  interval: config.GEMINI_MIN_REQUEST_INTERVAL_MS,
  classifier: config.MODEL_SERVICE_URL,
};
const original = {
  session: SessionModel.findOne,
  user: UserModel.findById,
  record: SubmissionModel.findOne,
  update: SubmissionModel.findOneAndUpdate,
  create: ClarificationModel.create,
  applied: ClarificationModel.updateOne,
  audit: AuditModel.create,
};
const owner = "111111111111111111111111",
  recordId = "444444444444444444444444";
let server: Server,
  base: string,
  record: any,
  fabricated = false,
  writes = 0,
  providerCalls = 0;

before(async () => {
  mongoose.connection.readyState = 1;
  config.GEMINI_API_KEY = "test-only";
  config.GROQ_API_KEY = "";
  config.GEMINI_MIN_REQUEST_INTERVAL_MS = 0;
  config.MODEL_SERVICE_URL = "";
  SessionModel.findOne = (() => ({
    lean: async () => ({ userId: owner }),
  })) as any;
  UserModel.findById = (() => ({
    lean: async () => ({
      _id: owner,
      name: "Owner",
      email: "test@example.test",
      role: "entrepreneur",
    }),
  })) as any;
  SubmissionModel.findOne = (async (filter: any) =>
    filter.ownerId === owner && String(filter._id) === recordId
      ? record
      : null) as any;
  SubmissionModel.findOneAndUpdate = (async (filter: any, update: any) => {
    assert.equal(filter.ownerId, owner);
    if (record.assessment.version !== filter["assessment.version"]) return null;
    writes++;
    record.history.push(update.$push.history);
    Object.assign(record, update.$set);
    return record;
  }) as any;
  ClarificationModel.create = (async () => ({
    _id: new mongoose.Types.ObjectId(),
  })) as any;
  ClarificationModel.updateOne = (async () => ({ modifiedCount: 1 })) as any;
  AuditModel.create = (async () => ({})) as any;
  globalThis.fetch = async (url, options) => {
    assert.match(
      String(url),
      /^https:\/\/generativelanguage\.googleapis\.com\//,
    );
    providerCalls++;
    const body = JSON.parse(String(options?.body));
    let value: any;
    if (body.generationConfig.responseJsonSchema.properties.segments) {
      assert.match(body.systemInstruction.parts[0].text, /How much of your own money/);
      const text = body.contents[0].parts[0].text;
      value = {
        language: "English",
        segments: [
          {
            originalText: text,
            englishText: text,
            page: null,
            startSeconds: null,
            endSeconds: null,
          },
        ],
      };
    } else {
      const segments = JSON.parse(body.contents[0].parts[0].text);
      value = {
        fields: [
          {
            key: "selfInvestment",
            value: fabricated ? "Rs. 9000" : segments[0].englishText,
            status: "supported",
            evidenceIds: [segments[0].id],
            reason: "Quoted",
          },
        ],
      };
    }
    return new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(value) }] },
          },
        ],
      }),
    );
  };
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api`;
});
beforeEach(() => {
  generationGate.reset();
  fabricated = false;
  writes = 0;
  providerCalls = 0;
  const assessment = assess({
    fields: [
      {
        key: "businessName",
        value: "Bags",
        status: "supported",
        evidenceIds: ["s1"],
        reason: "Quoted",
      },
    ],
    segments: [
      {
        id: "s1",
        originalText: "Bags",
        englishText: "Bags",
        page: null,
        startSeconds: null,
        endSeconds: null,
        kind: "text",
        verified: true,
      },
    ],
    language: "English",
    providerModel: "test",
  });
  assessment.questions = assessment.questions.slice(0, 3); // Existing saved assessments.
  record = {
    _id: new mongoose.Types.ObjectId(recordId),
    ownerId: owner,
    title: "Bags",
    createdAt: new Date(),
    updatedAt: new Date(),
    assessment,
    history: [],
    originalText: "Bags",
  };
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  globalThis.fetch = originalFetch;
  mongoose.connection.readyState = originalState;
  config.GEMINI_API_KEY = originalConfig.key;
  config.GROQ_API_KEY = originalConfig.groq;
  config.GEMINI_MIN_REQUEST_INTERVAL_MS = originalConfig.interval;
  config.MODEL_SERVICE_URL = originalConfig.classifier;
  generationGate.reset();
  SessionModel.findOne = original.session;
  UserModel.findById = original.user;
  SubmissionModel.findOne = original.record;
  SubmissionModel.findOneAndUpdate = original.update;
  ClarificationModel.create = original.create;
  ClarificationModel.updateOne = original.applied;
  AuditModel.create = original.audit;
});
const answer = (body: object) =>
  originalFetch(`${base}/submissions/${recordId}/clarifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "strive_session=test",
    },
    body: JSON.stringify(body),
  });

test("a previously omitted parameter accepts a short zero answer and preserves original evidence/history", async () => {
  assert.equal(
    record.assessment.questions.some((q: any) => q.field === "selfInvestment"),
    false,
  );
  const previous = structuredClone(record.assessment);
  const response = await answer({
    field: "selfInvestment",
    answer: "0",
    version: 1,
    language: "en-IN",
  });
  assert.equal(response.status, 200);
  const data: any = await response.json();
  assert.equal(data.submission.assessment.version, 2);
  assert.equal(
    data.submission.assessment.questions.some(
      (q: any) => q.field === "selfInvestment",
    ),
    false,
  );
  assert.equal(
    data.submission.assessment.fields.find(
      (f: any) => f.key === "selfInvestment",
    ).value,
    "0",
  );
  assert.equal(
    data.submission.assessment.fields.find((f: any) => f.key === "businessName")
      .value,
    "Bags",
  );
  assert.equal(data.submission.originalText, "Bags");
  assert.deepEqual(record.history, [previous]);
  assert.equal(data.submission.assessment.segments.length, 2);
  assert.equal(writes, 1);
});
test("supported answers and stale versions are rejected before provider calls", async () => {
  assert.equal(
    (await answer({ field: "businessName", answer: "Overwrite", version: 1 }))
      .status,
    400,
  );
  assert.equal(
    (await answer({ field: "selfInvestment", answer: "0", version: 8 })).status,
    409,
  );
  assert.equal(providerCalls, 0);
  assert.equal(writes, 0);
});
test("invented model values cannot close the question or alter the current assessment", async () => {
  fabricated = true;
  const response = await answer({
    field: "selfInvestment",
    answer: "0",
    version: 1,
    language: "en-IN",
  });
  assert.equal(response.status, 422);
  assert.equal(writes, 0);
  assert.equal(record.assessment.version, 1);
  assert.equal(record.history.length, 0);
});

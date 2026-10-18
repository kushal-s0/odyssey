import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, validateFields, cosine } from "../src/domain/assessment.js";
import {
  PARAMETER_QUESTIONS,
  unresolvedQuestions,
} from "../../shared/repair-questions.js";
import { serializeSubmission } from "../src/db.js";
import {
  FIELD_KEYS,
  type EvidenceField,
  type SourceSegment,
} from "../../shared/types.js";
const source = (text: string, id = "s1"): SourceSegment => ({
  id,
  originalText: text,
  englishText: text,
  page: null,
  startSeconds: null,
  endSeconds: null,
  kind: "text",
  verified: true,
});
const fact = (
  key: EvidenceField["key"],
  value: string,
  ids = ["s1"],
): EvidenceField => ({
  key,
  value,
  status: "supported",
  evidenceIds: ids,
  reason: "Model assertion",
});
test("withholds plausible but unsupported numbers and invalid citations", () => {
  const segments = [source("Projected monthly sales are Rs. 20,000.")];
  const result = validateFields(
    [
      fact("monthlyRevenue", "Rs. 60,000"),
      fact("investment", "Rs. 20,000", ["invented"]),
    ],
    segments,
  );
  assert.equal(
    result.fields.find((f) => f.key === "monthlyRevenue")?.value,
    null,
  );
  assert.equal(
    result.fields.find((f) => f.key === "investment")?.status,
    "missing",
  );
  assert.equal(result.warnings.length, 2);
});
test("accepts an exact quotation and preserves missing values as unknown", () => {
  const text = "I will sell milk at Rs. 60 per litre.";
  const result = assess({
    fields: [fact("unitPrice", "Rs. 60 per litre")],
    segments: [source(text)],
    language: "English",
    providerModel: "test",
  });
  assert.equal(
    result.fields.find((f) => f.key === "unitPrice")?.value,
    "Rs. 60 per litre",
  );
  assert.equal(
    result.fields.find((f) => f.key === "monthlyRevenue")?.value,
    null,
  );
  assert.equal(result.dimensions.find((d) => d.key === "clarity")?.score, null);
  assert.equal(result.score, null);
});
test("conflicting scalar amounts suppress an aggregate even when proposed as supported", () => {
  const text = "Rs. 20,000 per month. Overwritten: Rs. 60,000 per month.";
  const a = assess({
    fields: [fact("monthlyRevenue", text)],
    segments: [source(text)],
    language: "English",
    providerModel: "test",
  });
  assert.equal(
    a.fields.find((f) => f.key === "monthlyRevenue")?.status,
    "ambiguous",
  );
  assert.equal(a.score, null);
  assert.equal(a.reviewRequired, true);
  assert.equal(a.questions[0]?.field, "monthlyRevenue");
});
test("complete facts use stable deterministic arithmetic and seven dimensions", () => {
  const segments = FIELD_KEYS.map((key, i) =>
    source(`${key} evidence ${i}`, `s${i}`),
  );
  const fields = FIELD_KEYS.map((key, i) =>
    fact(key, `${key} evidence ${i}`, [`s${i}`]),
  );
  const input = {
    fields,
    segments,
    language: "English",
    providerModel: "test",
  };
  const a = assess(input),
    b = assess(input);
  assert.equal(a.score, 75);
  assert.equal(a.coverage, 100);
  assert.equal(a.completeness, 100);
  assert.equal(a.dimensions.length, 7);
  assert.deepEqual(a.dimensions, b.dimensions);
  assert.equal(a.questions.length, 0);
});
test("a model cannot silently select one amount from an explicitly overwritten source", () => {
  const text = "Rs. 20,000 per month. Overwritten: Rs. 60,000 per month.";
  const checked = validateFields(
    [fact("monthlyRevenue", "Rs. 60,000")],
    [source(text)],
  );
  assert.equal(
    checked.fields.find((f) => f.key === "monthlyRevenue")?.status,
    "ambiguous",
  );
});
test("verification does not manufacture missing facts or improve numeric scores", () => {
  const segment = { ...source("Tailoring business"), verified: false };
  const input = {
    fields: [fact("businessName", "Tailoring business")],
    segments: [segment],
    language: "English",
    providerModel: "test",
  };
  const a = assess(input),
    b = assess({ ...input, segments: [{ ...segment, verified: true }] });
  assert.equal(a.score, b.score);
  assert.equal(a.completeness, b.completeness);
  assert.equal(a.fields.find((f) => f.key === "research")?.status, "missing");
});
test("a clarification can resolve only its supplied evidence and keeps original segments", () => {
  const initial = assess({
    fields: [],
    segments: [source("I want to start a business.")],
    language: "English",
    providerModel: "test",
  });
  const clarification = source("My customers are school students.", "v2-s1");
  const next = assess({
    fields: [
      ...initial.fields.filter((f) => f.key !== "customers"),
      fact("customers", "school students", ["v2-s1"]),
    ],
    segments: [...initial.segments, clarification],
    language: "English",
    providerModel: "test",
    version: 2,
  });
  assert.equal(next.version, 2);
  assert.equal(next.segments.length, 2);
  assert.equal(initial.fields.find((f) => f.key === "customers")?.value, null);
  assert.equal(
    next.fields.find((f) => f.key === "customers")?.value,
    "school students",
  );
});
test("admitting no research is not scored as market-research evidence", () => {
  const a = assess({
    fields: [fact("research", "No survey done yet")],
    segments: [source("No survey done yet")],
    language: "English",
    providerModel: "test",
  });
  assert.equal(
    a.dimensions.find((d) => d.key === "customer_need")?.score,
    null,
  );
  assert.equal(
    a.fields.find((f) => f.key === "research")?.value,
    "No survey done yet",
  );
});
test("cosine handles dimension mismatch and empty/invalid vectors", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([1], [1, 2]), 0);
  assert.equal(cosine([0, 0], [1, 1]), 0);
  assert.equal(cosine([NaN], [1]), 0);
});

test("all 19 parameters have distinct questions and none are capped at three", () => {
  const assessment = assess({
    fields: [],
    segments: [],
    language: "English",
    providerModel: "test",
  });
  assert.equal(assessment.questions.length, FIELD_KEYS.length);
  assert.equal(
    new Set(assessment.questions.map((q) => q.field)).size,
    FIELD_KEYS.length,
  );
  assert.equal(
    new Set(Object.values(PARAMETER_QUESTIONS).map((q) => q.question)).size,
    FIELD_KEYS.length,
  );
  for (const field of [
    "trade",
    "sector",
    "materials",
    "selfInvestment",
    "loan",
    "monthlyCosts",
  ])
    assert.ok(assessment.questions.some((q) => q.field === field));
});

test("only unsupported parameters are asked; zero and explicit no-research answers remain answered", () => {
  const a = assess({
    fields: [
      fact("selfInvestment", "0"),
      fact("research", "No survey done yet"),
      fact("location", "Pune"),
    ],
    segments: [
      source("Own investment: 0. No survey done yet. Business location: Pune."),
    ],
    language: "English",
    providerModel: "test",
  });
  assert.equal(a.questions.length, FIELD_KEYS.length - 3);
  for (const field of ["selfInvestment", "research", "location"])
    assert.equal(
      a.questions.some((q) => q.field === field),
      false,
    );
  const unknown = assess({
    fields: [fact("loan", "unknown")],
    segments: [source("unknown")],
    language: "English",
    providerModel: "test",
  });
  assert.ok(unknown.questions.some((q) => q.field === "loan"));
});

test("unsupported, irrelevant and ambiguous answers remain questions and ambiguous information is first", () => {
  const a = assess({
    fields: [
      fact("monthlyCosts", "Invented costs"),
      { ...fact("customers", "unrelated"), status: "irrelevant" },
      { ...fact("unitPrice", "conflict"), status: "ambiguous" },
    ],
    segments: [source("No reliable financial answers.")],
    language: "English",
    providerModel: "test",
  });
  assert.equal(a.questions[0]?.field, "unitPrice");
  assert.match(a.questions[0]!.question, /conflicting/);
  assert.ok(a.questions.some((q) => q.field === "monthlyCosts"));
  assert.ok(a.questions.some((q) => q.field === "customers"));
});

test("old stored assessments get every pending question without modifying source, score or history", () => {
  const a = assess({
    fields: [fact("businessName", "Tailoring")],
    segments: [source("Tailoring")],
    language: "English",
    providerModel: "test",
  });
  a.questions = a.questions.slice(0, 3);
  const previous = structuredClone(a);
  const record = {
    _id: "temporary-test",
    createdAt: new Date(),
    updatedAt: new Date(),
    assessment: a,
    history: [previous],
  };
  const output = serializeSubmission(record);
  assert.equal(output.assessment.questions.length, FIELD_KEYS.length - 1);
  assert.equal(record.assessment.questions.length, 3);
  assert.equal(output.assessment.score, a.score);
  assert.deepEqual(output.assessment.segments, a.segments);
  assert.deepEqual(output.history, [previous]);
});

test("question translations are retained only for the exact current prompt and version", () => {
  const q = unresolvedQuestions([], 4);
  q[0]!.translatedQuestion = "Reviewed translation";
  assert.equal(
    unresolvedQuestions([], 4, q)[0]?.translatedQuestion,
    "Reviewed translation",
  );
  q[0]!.question = "Different question";
  assert.equal(unresolvedQuestions([], 4, q)[0]?.translatedQuestion, undefined);
  assert.equal(unresolvedQuestions([], 5, q)[0]?.translatedQuestion, undefined);
});

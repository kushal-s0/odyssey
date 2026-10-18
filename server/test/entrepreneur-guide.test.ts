import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IDEA_AREAS,
  entrepreneurSteps,
  BUSINESS_SUPPORT,
} from "../../shared/entrepreneur-guide.js";
import { FIELD_KEYS, type Submission } from "../../shared/types.js";
import { examples } from "../src/examples.js";
import { assess } from "../src/domain/assessment.js";
const record = () => structuredClone(examples[0]!) as Submission;
test("visual groups cover all 19 fields exactly once", () => {
  const fields = IDEA_AREAS.flatMap((a) => a.fields);
  assert.equal(fields.length, 19);
  assert.deepEqual([...fields].sort(), [...FIELD_KEYS].sort());
});
test("next steps use missing information and prioritize a conflicting answer without mutating evidence", () => {
  const r = record();
  r.assessment = assess({
    fields: [],
    segments: [],
    language: "English",
    providerModel: "test",
  });
  r.assessment.fields.find((f) => f.key === "monthlyCosts")!.status =
    "ambiguous";
  const before = JSON.stringify(r),
    steps = entrepreneurSteps(r);
  assert.equal(steps.length, 3);
  assert.equal(steps[0]!.field, "monthlyCosts");
  assert.equal(steps[0]!.title, "Clear up one answer");
  assert.equal(steps[1]!.key, "customers");
  assert.equal(steps[2]!.key, "money");
  assert.equal(JSON.stringify(r), before);
});
test("current reviewer advice stays verbatim and stale advice is excluded", () => {
  const r = record();
  r.review = {
    decision: "review",
    note: "checked",
    reviewedAt: new Date().toISOString(),
    assessmentVersion: r.assessment!.version,
    nextAction: "My own original advice.",
  };
  assert.equal(entrepreneurSteps(r)[0]!.note, r.review.nextAction);
  assert.equal(
    new Set(entrepreneurSteps(r).map((s) => s.key)).size,
    entrepreneurSteps(r).length,
  );
  r.review.assessmentVersion = 0;
  assert.ok(entrepreneurSteps(r).every((s) => !s.note));
  r.assessment = null;
  assert.deepEqual(entrepreneurSteps(r), []);
});
test("support links go to official resources and never claim eligibility", () => {
  assert.equal(BUSINESS_SUPPORT.length, 3);
  for (const item of BUSINESS_SUPPORT) {
    assert.equal(new URL(item.url).protocol, "https:");
    assert.match(
      new URL(item.url).hostname,
      /^(udyamregistration\.gov\.in|www\.jansamarth\.in|financialservices\.gov\.in)$/,
    );
  }
  assert.match(BUSINESS_SUPPORT[1].help, /not checked your eligibility/);
  assert.match(BUSINESS_SUPPORT[2].help, /must be repaid/);
});

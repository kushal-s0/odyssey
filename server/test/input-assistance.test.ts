import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inputAssistance,
  preparationChecklist,
  QUESTION_GROUPS,
} from "../../shared/input-assistance.js";
import { FIELD_KEYS } from "../../shared/types.js";
import { examples } from "../src/examples.js";
test("financial preparation keeps unknown separate from zero and does not change inputs", () => {
  const draft = {
    products: "Tea and biscuits for commuters.",
    monthlyRevenue: "20,000",
    monthlyCosts: "12000",
    investment: "10000",
    selfInvestment: "0",
    loan: "10000",
    priceUnit: "",
    researchStatus: "unknown",
  };
  const original = structuredClone(draft);
  const result = inputAssistance(draft);
  assert.equal(result.surplus, 8000);
  assert.equal(result.fundingGap, 0);
  assert.equal(result.entered, 6);
  assert.equal(result.total, 16);
  assert.deepEqual(draft, original);
  assert.equal(
    inputAssistance({
      products: "Tea and biscuits for commuters.",
      researchStatus: "unknown",
    }).surplus,
    null,
  );
  assert.equal(
    inputAssistance({ ...draft, monthlyCosts: "not money" }).surplus,
    null,
  );
});
test("financial constraints and price-unit requirements are visible in preparation", () => {
  const result = inputAssistance({
    products: "Tea and biscuits for commuters.",
    investment: "100",
    selfInvestment: "80",
    loan: "50",
    unitPrice: "10",
    researchStatus: "unknown",
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes("exceeds")));
  assert.ok(result.issues.some((issue) => issue.includes("unit")));
});
test("question groups cover every assessment parameter exactly once", () => {
  const keys = QUESTION_GROUPS.flatMap((group) => group.fields);
  assert.equal(keys.length, FIELD_KEYS.length);
  assert.equal(new Set(keys).size, FIELD_KEYS.length);
  for (const key of FIELD_KEYS) assert.ok(keys.includes(key));
});
test("downloaded checklist preserves stated evidence and contains only unresolved questions", () => {
  const record = structuredClone(examples[0]!);
  const previous = structuredClone(record);
  const text = preparationChecklist(record);
  assert.match(text, /Assessment version:/);
  assert.match(text, /FOLLOW-UP QUESTIONS/);
  assert.match(text, /Source references:/);
  assert.match(text, /does not update the assessment/);
  for (const q of record.assessment!.questions)
    assert.ok(text.includes(q.question));
  for (const f of record.assessment!.fields.filter(
    (f) => f.status === "supported",
  ))
    assert.ok(text.includes(f.value!));
  assert.deepEqual(record, previous);
});

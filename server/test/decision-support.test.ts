import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decisionSupport,
  quotedAmount,
} from "../src/domain/decision-support.js";
import { assess } from "../src/domain/assessment.js";
import type { FieldKey } from "../../shared/types.js";
function fixture(values: Partial<Record<FieldKey, string>>) {
  const entries = Object.entries(values) as [FieldKey, string][];
  return assess({
    fields: entries.map(([key, value], i) => ({
      key,
      value,
      status: "supported",
      evidenceIds: [`s${i}`],
      reason: "Quoted",
    })),
    segments: entries.map(([, value], i) => ({
      id: `s${i}`,
      originalText: value,
      englishText: value,
      kind: "text",
      verified: true,
      page: null,
      startSeconds: null,
      endSeconds: null,
    })),
    language: "English",
    providerModel: "test",
  });
}
test("unambiguous INR amounts support Indian grouping, native digits and explicit multipliers", () => {
  for (const [value, expected] of [
    ["INR 1,50,000", 150000],
    ["₹१२,००० per month", 12000],
    ["Rs. 1.5 lakh", 150000],
    ["20k", 20000],
    ["2 cr", 20000000],
    ["0", 0],
    ["I plan to invest INR 50000", 50000],
  ] as const)
    assert.equal(quotedAmount(value), expected, value);
  for (const value of [
    "Rs. 5000 or 9000",
    "between 5000 and 9000",
    "5000 rent + 2000 materials",
    "$500",
    "20%",
    "-500",
    "12,34",
    "2 billion",
    "1e5",
    "unknown",
    "1.5 लाख",
    "500 AUD",
    "up to INR 5000",
  ])
    assert.equal(quotedAmount(value), null, value);
  assert.equal(quotedAmount("Rs 5000 per week", true), null);
  assert.equal(quotedAmount("Profit Rs 5000 per month", true), null);
  assert.equal(quotedAmount("Rs 20000 per month", true), 20000);
});
test("missing projections do not become zero risk, and absent values remain null", () => {
  const support = decisionSupport(fixture({}));
  assert.equal(support.risk.score, null);
  assert.equal(support.risk.coverage, 0);
  assert.equal(support.risk.band, "insufficient_data");
  assert.equal(support.financials.monthlySurplus, null);
  assert.equal(support.financials.fundingPlanGap, null);
});
test("deficit, stress scenario and funding gaps have reproducible arithmetic and evidence", () => {
  const support = decisionSupport(
    fixture({
      monthlyRevenue: "INR 20000 per month",
      monthlyCosts: "INR 25000 per month",
      investment: "INR 100000",
      selfInvestment: "INR 10000",
      loan: "INR 50000",
    }),
  );
  assert.equal(support.financials.monthlySurplus, -5000);
  assert.equal(support.financials.marginPercent, -25);
  assert.equal(support.financials.stressedSurplus, -11500);
  assert.equal(support.financials.fundingPlanGap, 40000);
  assert.equal(support.risk.score, 100);
  assert.equal(support.risk.coverage, 100);
  assert.equal(support.risk.band, "higher");
  assert.equal(support.risk.factors[0]!.evidenceIds.length, 2);
  assert.ok(support.followUps.some((f) => f.title.includes("viability")));
});
test("strong stated margins have lower observed financial concern without claiming business success", () => {
  const support = decisionSupport(
    fixture({
      monthlyRevenue: "50000",
      monthlyCosts: "10000",
      investment: "100000",
      selfInvestment: "100000",
      loan: "0",
    }),
  );
  assert.equal(support.risk.score, 0);
  assert.equal(support.risk.band, "lower");
  assert.equal(support.financials.monthlySurplus, 40000);
  assert.match(support.risk.explanation, /not a probability/);
  const partial = decisionSupport(
    fixture({ monthlyRevenue: "50000", monthlyCosts: "10000" }),
  );
  assert.equal(partial.risk.coverage, 75);
  assert.equal(partial.financials.fundingPlanGap, null);
});
test("zero activity and balanced funding alone do not produce a numeric overall risk score", () => {
  const support = decisionSupport(
    fixture({
      monthlyRevenue: "0",
      monthlyCosts: "0",
      investment: "0",
      selfInvestment: "0",
      loan: "0",
    }),
  );
  assert.equal(support.risk.coverage, 25);
  assert.equal(support.risk.score, null);
  assert.equal(support.financials.marginPercent, null);
});
test("source-invalid numeric claims are excluded and the original assessment remains unchanged", () => {
  const a = fixture({ monthlyRevenue: "20000", monthlyCosts: "10000" });
  a.fields.find((f) => f.key === "monthlyRevenue")!.value = "90000";
  const original = structuredClone(a);
  const support = decisionSupport(a);
  assert.equal(support.risk.score, null);
  assert.equal(support.financials.monthlySales, null);
  assert.deepEqual(a, original);
});

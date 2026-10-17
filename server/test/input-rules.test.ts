import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessorReviewSchema,
  guidedIdeaSchema,
  moneyInput,
  registrationSchema,
  reviewEvidenceError,
  serializeGuidedIdea,
  submissionSchema,
} from "../../shared/input-rules.js";
import { examples } from "../src/examples.js";

const minimalIdea = {
  products: "Home-style meals and weekly subscriptions",
  researchStatus: "unknown",
};

test("money accepts Indian grouping and Indic digits while keeping unknown separate from zero", () => {
  assert.equal(moneyInput.parse("₹1,50,000.50"), 150000.5);
  assert.equal(moneyInput.parse("३०,०००"), 30000);
  assert.equal(moneyInput.parse("  "), null);
  assert.equal(moneyInput.parse("0"), 0);
  for (const value of [
    "-1",
    "1e6",
    "1,23",
    "4.333",
    "Rs.",
    Infinity,
    NaN,
    true,
    1_000_000_001,
  ])
    assert.equal(moneyInput.safeParse(value).success, false, String(value));
});
test("funding consistency rejects over-allocation without requiring unknown funding to become zero", () => {
  assert.equal(
    guidedIdeaSchema.safeParse({
      ...minimalIdea,
      investment: "100",
      selfInvestment: "80",
      loan: "50",
    }).success,
    false,
  );
  assert.equal(
    guidedIdeaSchema.safeParse({
      ...minimalIdea,
      investment: "100",
      loan: "101",
    }).success,
    false,
  );
  assert.equal(
    guidedIdeaSchema.safeParse({
      ...minimalIdea,
      investment: "100",
      selfInvestment: "20",
    }).success,
    true,
  );
});
test("guided input requires price units and details for completed research", () => {
  assert.equal(
    guidedIdeaSchema.safeParse({ ...minimalIdea, unitPrice: "10" }).success,
    false,
  );
  assert.equal(
    guidedIdeaSchema.safeParse({ ...minimalIdea, researchStatus: "done" })
      .success,
    false,
  );
  assert.equal(
    guidedIdeaSchema.safeParse({
      ...minimalIdea,
      researchDetails: "Some research details supplied.",
    }).success,
    false,
  );
});
test("standardized source never fills unknown money and labels sales as monthly projected revenue", () => {
  const idea = guidedIdeaSchema.parse({
    ...minimalIdea,
    monthlyRevenue: "40,000",
    monthlyCosts: "0",
  });
  const source = serializeGuidedIdea("Tiffin service", idea);
  assert.match(
    source,
    /INR 40000\.00 per month \(projected sales before expenses, not profit\)/,
  );
  assert.match(source, /operating costs: INR 0\.00 per month/);
  assert.equal(source.includes("Funding needed:"), false);
  assert.equal(source.includes("Target customers:"), false);
});
test("submissions cannot smuggle owners, both guided and free text, or financial answers into uploads", () => {
  const base = {
    beneficiaryName: "Test Entrepreneur",
    title: "Tiffin service",
    inputType: "text",
    submissionFormat: "guided",
    structuredInput: minimalIdea,
  };
  assert.equal(submissionSchema.safeParse(base).success, true);
  assert.equal(
    submissionSchema.safeParse({ ...base, ownerId: "another-user" }).success,
    false,
  );
  assert.equal(
    submissionSchema.safeParse({
      ...base,
      originalText: "A different invented business description.",
    }).success,
    false,
  );
  assert.equal(
    submissionSchema.safeParse({ ...base, inputType: "pdf" }).success,
    false,
  );
});
test("public signup cannot request assessor access or exploit bcrypt password truncation", () => {
  const base = {
    name: "Test Entrepreneur",
    email: " Test@Example.COM ",
    password: "long-test-passphrase",
  };
  assert.equal(registrationSchema.parse(base).email, "test@example.com");
  assert.equal(
    registrationSchema.safeParse({ ...base, role: "assessor" }).success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({ ...base, password: "密".repeat(30) })
      .success,
    false,
  );
});
test("assessor reviews require reasons, source review, current citations and an actionable next step", () => {
  const assessment = examples[0]!.assessment!;
  const input = {
    decision: "mentoring",
    note: "The proposed service needs further customer validation.",
    nextAction: "Arrange a customer research mentoring session.",
    reasonCodes: ["market_validation"],
    evidenceIds: [assessment.segments[0]!.id],
    sourceReviewed: true,
    version: assessment.version,
  };
  const review = assessorReviewSchema.parse(input);
  assert.equal(reviewEvidenceError(review, assessment), null);
  for (const change of [
    { sourceReviewed: false },
    { reasonCodes: [] },
    { evidenceIds: [] },
    { nextAction: "" },
    { note: "ok" },
  ])
    assert.equal(
      assessorReviewSchema.safeParse({ ...input, ...change }).success,
      false,
    );
  assert.match(
    reviewEvidenceError(
      { ...review, evidenceIds: ["not-this-record"] },
      assessment,
    )!,
    /this assessment/,
  );
  assert.match(
    reviewEvidenceError(
      { ...review, version: assessment.version + 1 },
      assessment,
    )!,
    /changed/,
  );
});

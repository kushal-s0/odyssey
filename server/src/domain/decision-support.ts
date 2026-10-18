import { moneyInput } from "../../../shared/input-rules.js";
import {
  FIELD_KEYS,
  FIELD_LABELS,
  type Assessment,
  type AssessorSupport,
  type FieldKey,
  type RiskFactor,
} from "../../../shared/types.js";
import { validateFields } from "./assessment.js";
import { screeningSummary } from "./screening.js";

// Deliberately conservative: mixed amounts/periods are unavailable, never summed
// or silently converted into the number the assessor might expect.
export function quotedAmount(
  value: string | null | undefined,
  monthly = false,
): number | null {
  if (
    !value ||
    /[$€£%]|\b(?:USD|EUR|GBP|AUD|CAD|AED|JPY|CNY|BDT|PKR|NPR)\b/i.test(value)
  )
    return null;
  const text = value.replace(
    /[\u0966-\u096F\u09E6-\u09EF\u0C66-\u0C6F\u0B66-\u0B6F]/gu,
    (char) => String((char.codePointAt(0)! % 16) - 6),
  );
  if (
    /[-−]\s*\d|\b(?:between|either|or|under|over|less than|more than|up to|at least|at most)\b/i.test(
      text,
    )
  )
    return null;
  if (
    monthly &&
    /\b(?:day|daily|week|weekly|year|yearly|annually|annual|profit|loss|margin)\b/i.test(
      text,
    )
  )
    return null;
  const amounts = [
    ...text.matchAll(
      /\d[\d,]*(?:\.\d+)?\s*(?:crores?|lakhs?|lacs?|thousand|million|cr|k)\b|\d[\d,]*(?:\.\d+)?/gi,
    ),
  ];
  if (amounts.length !== 1) return null;
  const after = text.slice(
    amounts[0]!.index! + amounts[0]![0].trimEnd().length,
  );
  if (
    /^\p{L}/u.test(after) ||
    /^\s*[\u0900-\u0DFF]/u.test(after) ||
    /^\s*(?:billion|hundred)\b/i.test(after)
  )
    return null;
  const token = amounts[0]![0].trim();
  const suffix = token.match(
    /\s*(crores?|lakhs?|lacs?|thousand|million|cr|k)$/i,
  )?.[1];
  const parsed = moneyInput.safeParse(
    token.replace(/\s*(crores?|lakhs?|lacs?|thousand|million|cr|k)$/i, ""),
  );
  if (!parsed.success || parsed.data === null) return null;
  const multiplier = /crore|^cr$/i.test(suffix ?? "")
    ? 1e7
    : /lakh|lac/i.test(suffix ?? "")
      ? 1e5
      : /million/i.test(suffix ?? "")
        ? 1e6
        : /thousand|^k$/i.test(suffix ?? "")
          ? 1000
          : 1;
  const result = parsed.data * multiplier;
  return moneyInput.safeParse(result).success ? result : null;
}

export function decisionSupport(assessment: Assessment): AssessorSupport {
  const fields = validateFields(assessment.fields, assessment.segments).fields;
  const supported = (key: FieldKey) =>
    fields.find((f) => f.key === key && f.status === "supported");
  const amount = (key: FieldKey, monthly = false) =>
    quotedAmount(supported(key)?.value, monthly);
  const refs = (...keys: FieldKey[]) => [
    ...new Set(keys.flatMap((key) => supported(key)?.evidenceIds ?? [])),
  ];
  const monthlySales = amount("monthlyRevenue", true),
    monthlyCosts = amount("monthlyCosts", true);
  const investment = amount("investment"),
    ownInvestment = amount("selfInvestment"),
    requestedFunding = amount("loan");
  const monthlySurplus =
    monthlySales !== null && monthlyCosts !== null
      ? Math.round((monthlySales - monthlyCosts) * 100) / 100
      : null;
  const marginPercent =
    monthlySurplus !== null && monthlySales !== null && monthlySales > 0
      ? Math.round((monthlySurplus / monthlySales) * 1000) / 10
      : null;
  const stressedSurplus =
    monthlySales !== null && monthlyCosts !== null
      ? Math.round((monthlySales * 0.8 - monthlyCosts * 1.1) * 100) / 100
      : null;
  const fundingPlanGap =
    investment !== null && ownInvestment !== null && requestedFunding !== null
      ? Math.round((investment - ownInvestment - requestedFunding) * 100) / 100
      : null;
  const activeProjection =
    monthlySales !== null &&
    monthlyCosts !== null &&
    (monthlySales > 0 || monthlyCosts > 0);
  const factors: RiskFactor[] = [
    {
      key: "operating_margin",
      label: "Projected operating headroom",
      weight: 50,
      points: !activeProjection
        ? null
        : monthlySurplus! <= 0
          ? 4
          : marginPercent! < 10
            ? 3
            : marginPercent! < 20
              ? 2
              : 0,
      explanation: !activeProjection
        ? "Needs usable monthly sales and costs with some projected activity."
        : `Stated sales minus stated costs: INR ${monthlySurplus!.toLocaleString("en-IN")} per month. Margin bands are screening rules, not industry benchmarks.`,
      evidenceIds: refs("monthlyRevenue", "monthlyCosts"),
    },
    {
      key: "stress",
      label: "Sales and cost stress",
      weight: 25,
      points: !activeProjection
        ? null
        : stressedSurplus! <= 0
          ? 4
          : stressedSurplus! < monthlySales! * 0.1
            ? 2
            : 0,
      explanation: !activeProjection
        ? "Needs usable monthly sales and costs."
        : `Scenario only: sales fall 20% and costs rise 10%, giving INR ${stressedSurplus!.toLocaleString("en-IN")} monthly surplus. This is not a forecast.`,
      evidenceIds: refs("monthlyRevenue", "monthlyCosts"),
    },
    {
      key: "funding",
      label: "Funding-plan consistency",
      weight: 25,
      points:
        fundingPlanGap === null
          ? null
          : fundingPlanGap > 0
            ? 4
            : fundingPlanGap < 0
              ? 3
              : 0,
      explanation:
        fundingPlanGap === null
          ? "Needs total setup investment, own funds and requested external funding."
          : fundingPlanGap > 0
            ? `INR ${fundingPlanGap.toLocaleString("en-IN")} of setup investment is not covered by the stated plan.`
            : fundingPlanGap < 0
              ? "Stated funding exceeds setup investment; clarify the allocation."
              : "The stated plan adds up. Requested external funding is not confirmed or approved funding.",
      evidenceIds: refs("investment", "selfInvestment", "loan"),
    },
  ];
  const coverage = factors
    .filter((f) => f.points !== null)
    .reduce((sum, f) => sum + f.weight, 0);
  const score =
    coverage < 50
      ? null
      : Math.round(
          (factors.reduce(
            (sum, f) => sum + ((f.points ?? 0) / 4) * f.weight,
            0,
          ) /
            coverage) *
            100,
        );
  const followUps: AssessorSupport["followUps"] = [];
  if (monthlySurplus !== null && monthlySurplus <= 0)
    followUps.push({
      title: "Check projected operating viability",
      detail:
        "Ask how sales, prices or costs will change to cover monthly operating expenses. Verify whether tax, owner pay and debt payments are included.",
      fields: ["monthlyRevenue", "monthlyCosts"],
    });
  if (fundingPlanGap !== null && fundingPlanGap !== 0)
    followUps.push({
      title: "Reconcile the funding plan",
      detail:
        "Confirm total setup costs, own funds and the purpose and availability of external funding.",
      fields: ["investment", "selfInvestment", "loan"],
    });
  for (const key of [
    "monthlyRevenue",
    "monthlyCosts",
    "investment",
    "selfInvestment",
    "loan",
  ] as const)
    if (
      amount(key, key === "monthlyRevenue" || key === "monthlyCosts") === null
    )
      followUps.push({
        title: `Confirm ${FIELD_LABELS[key].toLowerCase()}`,
        detail:
          "Obtain one unambiguous INR amount and the correct period. Missing or unparseable values are excluded from the risk score.",
        fields: [key],
      });
  for (const key of [
    "research",
    "competition",
    "differentiation",
    "suppliers",
    "experience",
  ] as const) {
    const value = supported(key)?.value;
    followUps.push({
      title: `Review ${FIELD_LABELS[key].toLowerCase()}`,
      detail: value
        ? `Applicant statement: “${value}”. Check its adequacy against the original and, where relevant, independent evidence.`
        : "This area lacks supported evidence. Ask the corresponding completion question before relying on it.",
      fields: [key],
    });
  }
  return {
    screening: screeningSummary(assessment, {monthlySales,monthlyCosts,monthlySurplus,marginPercent,investment,ownInvestment,requestedFunding,fundingPlanGap,stressedSurplus,evidenceIds:refs("monthlyRevenue","monthlyCosts","investment","selfInvestment","loan")}),
    version: "financial-screening-v1",
    assessmentVersion: assessment.version,
    risk: {
      score,
      band:
        score === null
          ? "insufficient_data"
          : score >= 60
            ? "higher"
            : score >= 25
              ? "moderate"
              : "lower",
      coverage,
      factors,
      explanation:
        "Rule-based financial screening of applicant projections, not a probability of failure or a lending recommendation. Higher means greater observed financial concern. Unknown factors are excluded; at least 50% of rule weight is required. Missing costs or unverified claims can materially change the result.",
    },
    financials: {
      monthlySales,
      monthlyCosts,
      monthlySurplus,
      marginPercent,
      investment,
      ownInvestment,
      requestedFunding,
      fundingPlanGap,
      stressedSurplus,
      evidenceIds: refs(
        "monthlyRevenue",
        "monthlyCosts",
        "investment",
        "selfInvestment",
        "loan",
      ),
    },
    evidence: {
      supported: fields.filter((f) => f.status === "supported").length,
      total: FIELD_KEYS.length,
      conflicts: fields.filter((f) => f.status === "ambiguous").length,
      verifiedSegments: assessment.segments.filter((s) => s.verified).length,
      totalSegments: assessment.segments.length,
    },
    followUps,
  };
}

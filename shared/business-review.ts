import type { Submission } from "./types.js";
export const BUSINESS_DOMAINS = [
  {
    key: "clarity",
    label: "Clarity",
    weight: 15,
    prompt: "Is the offer and business model understandable?",
  },
  {
    key: "customer_need",
    label: "Customer need",
    weight: 20,
    prompt: "How convincing is the evidence of a specific customer problem?",
  },
  {
    key: "market_potential",
    label: "Market potential",
    weight: 15,
    prompt: "Are demand, pricing and projected sales plausible and supported?",
  },
  {
    key: "feasibility",
    label: "Feasibility",
    weight: 25,
    prompt:
      "Can the proposed skills, resources, finances and operations deliver it?",
  },
  {
    key: "competition",
    label: "Competition",
    weight: 10,
    prompt:
      "Does the proposal account for relevant alternatives and local competition?",
  },
  {
    key: "differentiation",
    label: "Differentiation",
    weight: 15,
    prompt: "Is there a credible reason customers would choose this offer?",
  },
] as const;
export type BusinessDomainKey = (typeof BUSINESS_DOMAINS)[number]["key"];
export interface DomainRating {
  key: BusinessDomainKey;
  score: number;
  reason: string;
  evidenceIds: string[];
}
export function reviewedPotential(record: Submission) {
  const review = record.review,
    a = record.assessment;
  const ratings =
    review?.assessmentVersion === a?.version
      ? (review?.domainRatings ?? [])
      : [];
  const current = BUSINESS_DOMAINS.flatMap((d) => {
    const r = ratings.find((r) => r.key === d.key);
    return r && Number.isInteger(r.score) && r.score >= 0 && r.score <= 4
      ? [{ ...r, label: d.label, weight: d.weight }]
      : [];
  });
  return {
    ratings: current,
    coverage: Math.round((current.length / BUSINESS_DOMAINS.length) * 100),
    score:
      current.length === BUSINESS_DOMAINS.length
        ? Math.round(
            current.reduce((sum, r) => sum + (r.score / 4) * r.weight, 0),
          )
        : null,
  };
}

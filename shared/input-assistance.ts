import { guidedIdeaSchema, moneyInput } from "./input-rules.js";
import {
  FIELD_KEYS,
  FIELD_LABELS,
  type FieldKey,
  type Submission,
} from "./types.js";
import { unresolvedQuestions } from "./repair-questions.js";

export const QUESTION_GROUPS: {
  key: string;
  label: string;
  fields: readonly FieldKey[];
}[] = [
  {
    key: "business",
    label: "Business",
    fields: [
      "businessName",
      "trade",
      "sector",
      "products",
      "customers",
      "problem",
    ],
  },
  {
    key: "operations",
    label: "Operations",
    fields: ["location", "materials", "suppliers", "experience"],
  },
  {
    key: "finances",
    label: "Finances",
    fields: [
      "investment",
      "selfInvestment",
      "loan",
      "unitPrice",
      "monthlyRevenue",
      "monthlyCosts",
    ],
  },
  {
    key: "market",
    label: "Market",
    fields: ["research", "competition", "differentiation"],
  },
];
const textKeys = [
  "products",
  "customers",
  "problem",
  "location",
  "materials",
  "suppliers",
  "competition",
  "differentiation",
  "experience",
];
const financialKeys = [
  "investment",
  "selfInvestment",
  "loan",
  "unitPrice",
  "monthlyRevenue",
  "monthlyCosts",
];

export function inputAssistance(draft: Record<string, string>) {
  const parsed = guidedIdeaSchema.safeParse(draft);
  const amount = (key: string) => {
    const result = moneyInput.safeParse(draft[key]);
    return result.success ? result.data : null;
  };
  const sales = amount("monthlyRevenue"),
    costs = amount("monthlyCosts");
  const investment = amount("investment"),
    own = amount("selfInvestment"),
    external = amount("loan");
  return {
    entered:
      [...textKeys, ...financialKeys].filter((key) => draft[key]?.trim())
        .length +
      (draft.researchStatus && draft.researchStatus !== "unknown" ? 1 : 0),
    total: 16,
    valid: parsed.success,
    issues: parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((issue) => issue.message))],
    surplus:
      sales !== null && costs !== null
        ? Math.round((sales - costs) * 100) / 100
        : null,
    fundingGap:
      investment !== null && own !== null && external !== null
        ? Math.round((investment - own - external) * 100) / 100
        : null,
  };
}

export function preparationChecklist(record: Submission): string {
  const a = record.assessment;
  if (!a)
    throw new Error(
      "An assessment is required before downloading a checklist.",
    );
  const questions = unresolvedQuestions(a.fields, a.version, a.questions);
  const lines = [
    "STRIVE — Preparation checklist",
    record.title,
    `Assessment version: ${a.version}`,
    `Prepared: ${new Date().toISOString()}`,
    "",
    "Applicant-stated information; source references do not independently verify claims.",
    "",
    `FOLLOW-UP QUESTIONS (${questions.length})`,
    "",
  ];
  if (!questions.length)
    lines.push(
      "No outstanding questions. Review the original evidence and assessor feedback.",
    );
  for (const q of questions)
    lines.push(
      FIELD_LABELS[q.field],
      q.question,
      `Why: ${q.reason}`,
      "Your answer: __________________________",
      "",
    );
  lines.push("INFORMATION ALREADY SUPPLIED", "");
  for (const key of FIELD_KEYS) {
    const field = a.fields.find(
      (f) => f.key === key && f.status === "supported" && f.value?.trim(),
    );
    if (field)
      lines.push(
        `${FIELD_LABELS[key]}: ${field.value}`,
        `Source references: ${field.evidenceIds.join(", ") || "Not supplied"}`,
        "",
      );
  }
  if (record.review)
    lines.push(
      "ASSESSOR FEEDBACK",
      record.review.note,
      ...(record.review.nextAction
        ? [`Next action: ${record.review.nextAction}`]
        : []),
      "",
    );
  lines.push(
    "Save answers through the website's Complete missing information section. This downloaded checklist does not update the assessment.",
  );
  return lines.join("\n");
}

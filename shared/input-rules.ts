import { z } from "zod";
import type { Assessment } from "./types.js";

export const LANGUAGE_CODES = [
  "auto",
  "en-IN",
  "hi-IN",
  "mr-IN",
  "te-IN",
  "bn-IN",
  "od-IN",
] as const;
const controls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
export function textInput(label: string, minimum: number, maximum: number) {
  return z
    .string()
    .transform((value) => value.normalize("NFC").replace(/\r\n?/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(minimum, `${label} needs at least ${minimum} characters.`)
        .max(maximum, `${label} allows at most ${maximum} characters.`)
        .refine(
          (value) => !controls.test(value),
          `${label} contains unsupported control characters.`,
        )
        .refine(
          (value) => /[\p{L}\p{N}]/u.test(value),
          `${label} must contain readable text.`,
        ),
    );
}
const optionalText = (label: string, maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.union([z.literal(""), textInput(label, 3, maximum)]).default(""),
  );
export const emailInput = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);
export const passwordInput = z
  .string()
  .min(12, "Use at least 12 characters for your password.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password must fit within 72 UTF-8 bytes.",
  );
export const registrationSchema = z
  .object({
    name: textInput("Your name", 2, 100),
    email: emailInput,
    password: passwordInput,
  })
  .strict();
export const loginSchema = z
  .object({
    email: emailInput,
    password: z
      .string()
      .min(1)
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        "Password must fit within 72 UTF-8 bytes.",
      ),
  })
  .strict();

export const MAX_AMOUNT_INR = 1_000_000_000;
export const changePasswordSchema = z
  .object({
    currentPassword: loginSchema.shape.password,
    newPassword: passwordInput,
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "Choose a new password different from your current password.",
  });
export const moneyInput = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "number") return value;
    if (typeof value !== "string") return value;
    if (!value.trim()) return null;
    const clean = value
      .trim()
      .replace(
        /[\u0966-\u096F\u09E6-\u09EF\u0C66-\u0C6F\u0B66-\u0B6F]/gu,
        (character) => {
          const point = character.codePointAt(0)!;
          const base = [0x0966, 0x09e6, 0x0c66, 0x0b66].find(
            (value) => point >= value && point <= value + 9,
          )!;
          return String(point - base);
        },
      )
      .replace(/^(?:₹|INR\s*|Rs\.?\s*)/i, "")
      .trim();
    if (!clean) return Number.NaN;
    if (
      !/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(
        clean,
      )
    )
      return Number.NaN;
    return Number(clean.replaceAll(",", ""));
  },
  z
    .number({
      invalid_type_error:
        "Enter an INR amount, with at most two decimal places.",
    })
    .finite()
    .min(0, "Amounts cannot be negative.")
    .max(MAX_AMOUNT_INR, "Amount exceeds the supported input limit.")
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
      "Use at most two decimal places.",
    )
    .nullable(),
);

export const FINANCIAL_FIELDS = [
  ["investment", "Total setup investment"],
  ["selfInvestment", "Own investment"],
  ["loan", "Funding needed"],
  ["unitPrice", "Price per product / service"],
  ["monthlyRevenue", "Projected monthly sales"],
  ["monthlyCosts", "Projected monthly operating costs"],
] as const;
export const guidedIdeaSchema = z
  .object({
    products: textInput("Products and services", 10, 1200),
    customers: optionalText("Target customers", 800),
    problem: optionalText("Customer problem", 1000),
    location: optionalText("Business location", 250),
    materials: optionalText("Materials and equipment", 1000),
    suppliers: optionalText("Suppliers", 800),
    competition: optionalText("Competition", 1000),
    differentiation: optionalText("Differentiation", 1000),
    experience: optionalText("Relevant experience", 800),
    investment: moneyInput,
    selfInvestment: moneyInput,
    loan: moneyInput,
    unitPrice: moneyInput,
    monthlyRevenue: moneyInput,
    monthlyCosts: moneyInput,
    priceUnit: z.preprocess(
      (value) =>
        typeof value === "string"
          ? value.trim().replace(/^per\s+/i, "")
          : value,
      z.union([z.literal(""), textInput("Price unit", 1, 80)]).default(""),
    ),
    researchStatus: z.enum(["unknown", "not_done", "planned", "done"]),
    researchDetails: optionalText("Market research details", 1200),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.unitPrice !== null && !data.priceUnit)
      context.addIssue({
        code: "custom",
        path: ["priceUnit"],
        message:
          "Specify the unit, such as per meal, per garment or per litre.",
      });
    if (data.investment !== null) {
      if (data.selfInvestment !== null && data.selfInvestment > data.investment)
        context.addIssue({
          code: "custom",
          path: ["selfInvestment"],
          message: "Own investment cannot exceed the total setup investment.",
        });
      if (data.loan !== null && data.loan > data.investment)
        context.addIssue({
          code: "custom",
          path: ["loan"],
          message: "Funding needed cannot exceed the total setup investment.",
        });
      if (
        data.selfInvestment !== null &&
        data.loan !== null &&
        Math.round((data.selfInvestment + data.loan) * 100) >
          Math.round(data.investment * 100)
      )
        context.addIssue({
          code: "custom",
          path: ["loan"],
          message:
            "Own investment plus funding needed exceeds the total setup investment. Check the amounts.",
        });
    }
    if (data.researchStatus === "done" && data.researchDetails.length < 20)
      context.addIssue({
        code: "custom",
        path: ["researchDetails"],
        message:
          "Describe who you consulted, how and what you learned (at least 20 characters).",
      });
    if (data.researchStatus === "unknown" && data.researchDetails)
      context.addIssue({
        code: "custom",
        path: ["researchStatus"],
        message: "Choose a research status to match the details you entered.",
      });
  });
export type GuidedIdea = z.output<typeof guidedIdeaSchema>;

export function serializeGuidedIdea(title: string, idea: GuidedIdea) {
  const statements = [
    `Business idea: ${title}`,
    `Products and services: ${idea.products}`,
    ...(idea.customers ? [`Target customers: ${idea.customers}`] : []),
    ...(
      [
        ["problem", "Customer problem"],
        ["location", "Business location"],
        ["materials", "Materials and equipment"],
        ["suppliers", "Suppliers"],
        ["competition", "Competition"],
        ["differentiation", "Differentiation"],
        ["experience", "Relevant experience"],
      ] as const
    )
      .filter(([key]) => idea[key])
      .map(([key, label]) => `${label}: ${idea[key]}`),
  ];
  for (const [key, label] of FINANCIAL_FIELDS) {
    const amount = idea[key];
    if (amount === null) continue;
    const unit =
      key === "unitPrice"
        ? ` per ${idea.priceUnit}`
        : key.startsWith("monthly")
          ? " per month"
          : "";
    statements.push(
      `${label}: INR ${amount.toFixed(2)}${unit}${key === "monthlyRevenue" ? " (projected sales before expenses, not profit)" : ""}`,
    );
  }
  if (idea.researchStatus !== "unknown") {
    const status = {
      not_done: "No market research conducted yet",
      planned: "Market research planned, not conducted yet",
      done: "Market research conducted, as stated by the entrepreneur",
    }[idea.researchStatus];
    statements.push(
      `Market research: ${status}${idea.researchDetails ? `. ${idea.researchDetails}` : ""}`,
    );
  }
  return statements.join("\n\n");
}

const guidedJson = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}, guidedIdeaSchema);
export const submissionSchema = z
  .object({
    beneficiaryName: textInput("Entrepreneur name", 2, 100),
    title: textInput("Idea title", 3, 150),
    language: z.enum(LANGUAGE_CODES).default("auto"),
    inputType: z.enum(["text", "pdf", "audio"]),
    submissionFormat: z.enum(["guided", "free_text", "upload"]).optional(),
    originalText: textInput("Business idea", 20, 20000).optional(),
    structuredInput: guidedJson.optional(),
    cohortId: z.string().max(24).optional(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.inputType === "text") {
      if (data.submissionFormat === "upload")
        context.addIssue({
          code: "custom",
          path: ["submissionFormat"],
          message: "Choose a text input format.",
        });
      if (
        data.submissionFormat === "guided" &&
        (!data.structuredInput || data.originalText !== undefined)
      )
        context.addIssue({
          code: "custom",
          path: ["structuredInput"],
          message:
            "Send guided answers only; their source text is created by the server.",
        });
      if (
        data.submissionFormat !== "guided" &&
        (!data.originalText || data.structuredInput !== undefined)
      )
        context.addIssue({
          code: "custom",
          path: ["originalText"],
          message: "Provide a business description of at least 20 characters.",
        });
    } else if (
      data.originalText !== undefined ||
      data.structuredInput !== undefined ||
      (data.submissionFormat && data.submissionFormat !== "upload")
    ) {
      context.addIssue({
        code: "custom",
        path: ["inputType"],
        message:
          "PDF and audio submissions must contain only their uploaded source and basic details.",
      });
    }
  });

export const REVIEW_REASONS = [
  ["clear_proposal", "Proposal is sufficiently described"],
  ["missing_information", "Missing information"],
  ["source_conflict", "Conflicting or unclear source evidence"],
  ["financial_validation", "Financial details need validation"],
  ["market_validation", "Customer or market assumptions need validation"],
  ["skills_support", "Mentoring or skills support"],
  ["other", "Other reason"],
] as const;
export const assessorReviewSchema = z
  .object({
    decision: z.enum([
      "deeper_evaluation",
      "mentoring",
      "clarification",
      "reviewed",
    ]),
    note: textInput("Review rationale", 20, 2000),
    nextAction: optionalText("Next action", 600),
    reasonCodes: z
      .array(
        z.enum([
          "clear_proposal",
          "missing_information",
          "source_conflict",
          "financial_validation",
          "market_validation",
          "skills_support",
          "other",
        ]),
      )
      .min(1, "Select at least one review reason.")
      .max(4)
      .refine(
        (values) => new Set(values).size === values.length,
        "Choose each reason once.",
      ),
    evidenceIds: z
      .array(z.string().min(1).max(100))
      .min(1, "Select at least one supporting source segment.")
      .max(20)
      .refine(
        (values) => new Set(values).size === values.length,
        "Choose each evidence segment once.",
      ),
    sourceReviewed: z.literal(true, {
      errorMap: () => ({
        message: "Review the original source and confirm it before saving.",
      }),
    }),
    domainRatings: z
      .array(
        z
          .object({
            key: z.enum([
              "clarity",
              "customer_need",
              "market_potential",
              "feasibility",
              "competition",
              "differentiation",
            ]),
            score: z.number().int().min(0).max(4),
            reason: textInput("Domain rating rationale", 20, 600),
            evidenceIds: z
              .array(z.string().min(1).max(100))
              .min(1, "Cite a source for each domain rating.")
              .max(20),
          })
          .strict(),
      )
      .max(6)
      .refine(
        (rows) => new Set(rows.map((r) => r.key)).size === rows.length,
        "Rate each domain once.",
      )
      .optional(),
    version: z.number().int().positive(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.decision !== "reviewed" && data.nextAction.length < 10)
      context.addIssue({
        code: "custom",
        path: ["nextAction"],
        message: "Describe the next action in at least 10 characters.",
      });
  });
export type AssessorReviewInput = z.output<typeof assessorReviewSchema>;
export function reviewEvidenceError(
  review: AssessorReviewInput,
  assessment: Assessment,
) {
  if (review.version !== assessment.version)
    return "This assessment changed. Refresh before saving your review.";
  if (
    [
      ...review.evidenceIds,
      ...(review.domainRatings ?? []).flatMap((r) => r.evidenceIds),
    ].some((id) => !assessment.segments.some((segment) => segment.id === id))
  )
    return "Choose evidence from this assessment version only.";
  return null;
}

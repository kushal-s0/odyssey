import {
  FIELD_KEYS,
  type EvidenceField,
  type FieldKey,
  type RepairQuestion,
} from "./types.js";

// Fixed questions never invent facts or depend on a model choosing what to ask.
export const PARAMETER_QUESTIONS: Record<
  FieldKey,
  { question: string; hint: string }
> = {
  businessName: {
    question: "What is your business idea or business name?",
    hint: "Briefly name and describe the business you want to run.",
  },
  trade: {
    question: "What trade or business activity will you carry out?",
    hint: "Describe the main work, such as making, selling, repairing, or providing a service.",
  },
  sector: {
    question: "Which industry or sector does your business belong to?",
    hint: "State the industry that best describes your main business activity.",
  },
  products: {
    question: "What products or services will you offer?",
    hint: "List the main products or services and what customers will receive.",
  },
  customers: {
    question: "Who are your target customers?",
    hint: "Describe the people or businesses you expect to buy from you.",
  },
  problem: {
    question: "What customer problem or need will your business address?",
    hint: "Explain the difficulty customers face and how your offering helps.",
  },
  location: {
    question: "Where will you operate your business?",
    hint: "Give the village, town, or city and describe whether you will work from home, a shop, online, or elsewhere.",
  },
  materials: {
    question: "What materials, equipment, or facilities will you need?",
    hint: "List the main items needed to make or deliver your product or service.",
  },
  suppliers: {
    question: "Where will you obtain your materials, stock, or equipment?",
    hint: "Describe your suppliers or sourcing plan. State if you have not identified suppliers yet.",
  },
  investment: {
    question: "How much total investment will you need to start the business?",
    hint: "State the total amount in INR and what it will cover. State 0 only if no investment is needed.",
  },
  selfInvestment: {
    question: "How much of your own money will you invest?",
    hint: "State the amount in INR. State 0 if you will not contribute your own funds.",
  },
  loan: {
    question: "How much external funding or borrowing will you need?",
    hint: "State the amount in INR and the funding source if known. State 0 if none is needed.",
  },
  unitPrice: {
    question: "What price will you charge for each product or service?",
    hint: "Include the amount in INR and the unit, such as per item, per kilogram, per hour, or per service.",
  },
  monthlyRevenue: {
    question: "What monthly sales revenue do you expect?",
    hint: "State projected sales in INR per month, before subtracting costs. Explain your estimate if possible.",
  },
  monthlyCosts: {
    question: "What will your monthly operating costs be?",
    hint: "State costs in INR per month, including relevant rent, materials, wages, utilities, or transport.",
  },
  research: {
    question: "What market research have you done, and what did you learn?",
    hint: "Describe customer conversations, surveys, or other research and findings. You can explicitly state that you have not done research yet.",
  },
  competition: {
    question: "Who are your competitors or the alternatives customers use?",
    hint: "Describe competing businesses or alternatives and what they offer. State if you have not investigated this yet.",
  },
  differentiation: {
    question: "Why would customers choose your business over the alternatives?",
    hint: "Describe the specific difference in your product, service, price, convenience, or approach.",
  },
  experience: {
    question: "What relevant skills, training, or experience do you have?",
    hint: "Describe experience related to this business, or explicitly state that you are new to this work.",
  },
};

export function unresolvedQuestions(
  fields: EvidenceField[],
  version: number,
  previous: RepairQuestion[] = [],
): RepairQuestion[] {
  return FIELD_KEYS.filter((key) => {
    const field = fields.find((item) => item.key === key);
    return field?.status !== "supported" || !field.value?.trim();
  })
    .sort(
      (a, b) =>
        Number(fields.find((f) => f.key === b)?.status === "ambiguous") -
        Number(fields.find((f) => f.key === a)?.status === "ambiguous"),
    )
    .map((field) => {
      const evidence = fields.find((item) => item.key === field);
      const question = `${evidence?.status === "ambiguous" ? "The input contains conflicting or unclear answers. Please confirm: " : ""}${PARAMETER_QUESTIONS[field].question}`;
      const id = `repair-${version}-${field}`;
      const translatedQuestion = previous.find(
        (q) => q.id === id && q.field === field && q.question === question,
      )?.translatedQuestion;
      return {
        id,
        field,
        question,
        reason: evidence?.reason || "Not provided in the available evidence.",
        ...(translatedQuestion ? { translatedQuestion } : {}),
      };
    });
}

import type { FieldKey, Submission } from "./types.js";

export const IDEA_AREAS: {
  key: string;
  label: string;
  help: string;
  fields: FieldKey[];
}[] = [
  {
    key: "idea",
    label: "Your idea",
    help: "What will you sell? What problem will it solve? Add a clear answer for each detail. Tap this card to see what you have already shared.",
    fields: ["businessName", "trade", "sector", "products", "problem"],
  },
  {
    key: "customers",
    label: "Customers",
    help: "Who will buy from you? Learn what they need, what they pay today, and why they would choose you. A clear plan is different from proof of demand.",
    fields: ["customers", "research", "competition", "differentiation"],
  },
  {
    key: "money",
    label: "Money",
    help: "List your starting money, selling price, monthly sales and costs. Sales are not profit. Missing amounts stay unknown, never zero.",
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
    key: "setup",
    label: "Getting ready",
    help: "Where will you work? Who will supply what you need? Add your location, materials, suppliers and experience before making a bigger commitment.",
    fields: ["location", "materials", "suppliers", "experience"],
  },
];
export interface BusinessStep {
  key: string;
  title: string;
  hint: string;
  why: string;
  tasks: string[];
  field?: FieldKey;
  note?: string;
}
export function entrepreneurSteps(record: Submission): BusinessStep[] {
  const a = record.assessment;
  if (!a) return [];
  const missing = new Set(a.questions.map((q) => q.field));
  const result: BusinessStep[] = [];
  // A stale review is never presented as advice for a newer assessment.
  if (
    record.review?.nextAction &&
    record.review.assessmentVersion === a.version
  )
    result.push({
      key: "review",
      title: "Start with your reviewer's advice",
      hint: "A personal next step",
      why: "Your reviewer suggested this for the current version of your idea.",
      tasks: [],
      note: record.review.nextAction,
    });
  const conflict = a.fields.find((f) => f.status === "ambiguous");
  const first = conflict?.key ?? a.questions[0]?.field;
  if (first)
    result.push({
      key: "answer",
      title: conflict ? "Clear up one answer" : "Add one missing detail",
      hint: "Start small",
      why: conflict
        ? "Some answers do not agree. Confirm the right detail before using the score."
        : "A few details are missing. Add one answer at a time; you do not need to finish everything today.",
      tasks: [
        "Use your own figures and words.",
        "If you do not know yet, say so.",
      ],
      field: first,
    });
  if (
    ["customers", "research", "problem"].some((f) => missing.has(f as FieldKey))
  )
    result.push({
      key: "customers",
      title: "Talk to three customers",
      hint: "Test the need",
      why: "Customer details or research are missing. A few real conversations can help you check your idea before spending more.",
      tasks: [
        "Ask what problem they face.",
        "Ask what they use and pay for today.",
        "Write down what you hear; do not assume they will buy.",
      ],
    });
  if (
    ["monthlyRevenue", "monthlyCosts", "investment", "unitPrice"].some((f) =>
      missing.has(f as FieldKey),
    )
  )
    result.push({
      key: "money",
      title: "Make a simple money plan",
      hint: "Sales minus costs",
      why: "Your money plan needs more detail. List costs and expected sales separately; an estimate is not a promise of profit.",
      tasks: [
        "List one-time starting costs.",
        "List monthly sales and monthly costs.",
        "Check your figures with a reviewer.",
      ],
      field: a.questions.find(
        (q) => q.field === "monthlyCosts" || q.field === "monthlyRevenue",
      )?.field,
    });
  if (["materials", "suppliers"].some((f) => missing.has(f as FieldKey)))
    result.push({
      key: "suppliers",
      title: "Get two supplier quotes",
      hint: "Check prices first",
      why: "Material or supplier details are missing. Written quotes can help you make a more realistic plan.",
      tasks: [
        "Ask two suppliers for a written price.",
        "Compare delivery time and minimum order.",
        "Keep a copy of each quote.",
      ],
    });
  if (
    result.length < 3 &&
    ["competition", "differentiation"].some((f) => missing.has(f as FieldKey))
  )
    result.push({
      key: "competition",
      title: "Look at nearby businesses",
      hint: "Find your difference",
      why: "Competitor details are missing. Visit a few similar businesses and note what you could do differently.",
      tasks: [
        "Compare products and prices.",
        "Ask customers what is missing.",
        "Write one clear reason to choose your business.",
      ],
    });
  if (result.length < 3)
    result.push({
      key: "mentor",
      title: "Check your plan with a reviewer",
      hint: "A second pair of eyes",
      why: "Having all the details does not prove the business will succeed. Ask someone to check your sources, costs and customer plan.",
      tasks: [
        "Bring your original document or notes.",
        "Ask which assumptions need checking.",
        "Agree on one small next action.",
      ],
    });
  if (result.length < 3)
    result.push({
      key: "pilot",
      title: "Try a small first sale",
      hint: "Learn before growing",
      why: "Once your reviewer agrees the basics are ready, a small test can help you learn. It is a suggestion, not a guarantee of sales.",
      tasks: [
        "Choose a small test you can afford.",
        "Record what you spend and sell.",
        "Ask buyers what to improve.",
      ],
    });
  return result.slice(0, 3);
}
export const BUSINESS_SUPPORT = [
  {
    key: "udyam",
    name: "Udyam / MSME",
    title: "Explore business registration",
    help: "Udyam is the official MSME registration portal. Registration is free on the government website. Check the current rules; registration is not a grant or a loan.",
    url: "https://udyamregistration.gov.in/",
    type: "Registration",
  },
  {
    key: "jansamarth",
    name: "JanSamarth",
    title: "Explore government loan schemes",
    help: "JanSamarth helps you explore government credit schemes and check their rules. We have not checked your eligibility. The lender decides whether to approve an application.",
    url: "https://www.jansamarth.in/",
    source: "https://financialservices.gov.in/jansamarth",
    type: "Check eligibility",
  },
  {
    key: "mudra",
    name: "MUDRA / PMMY",
    title: "Learn about small-business loans",
    help: "MUDRA supports loans through participating lenders. A loan must be repaid; it is not free cash. Check eligibility, interest and repayment terms with the lender before applying.",
    url: "https://financialservices.gov.in/pradhan-mantri-mudra-yojana-pmmy",
    type: "Check eligibility",
  },
] as const;

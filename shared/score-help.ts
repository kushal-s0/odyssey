/** Explanations for application calculations. Never rewrites a submitted answer. */
export const SCORE_HELP = {
  readiness: {
    title: "Details score",
    text: "This checks how much useful information is in your idea. It does not tell you whether your business will succeed. The current automatic score can reach 75 out of 100. We hide it when too much information is missing or important answers disagree.",
  },
  completeness: {
    title: "Main details added",
    text: "This is the share of 14 main business details found in your answers. For example, 50% means 7 of 14 details were found. It is separate from your details score. The full question list checks 19 details.",
  },
  coverage: {
    title: "Areas we can check",
    text: "Some parts of an idea count more in the total score. This percentage adds up the share for parts we can check. We need at least 70% before showing a total. It is not a chance of success.",
  },
  answered: {
    title: "Answers found",
    text: "This counts answers found in your document, recording or follow-up answers, out of all 19 details. A source shows where an answer came from. It does not prove the answer is true.",
  },
  weight: {
    title: "Share of the total",
    text: "This tells you how much a part counts in the total score. A 25% share counts more than a 10% share. These shares are fixed app rules, not facts learned from successful businesses.",
  },
  points: {
    title: "Points added",
    text: "Points added = part score divided by 4, then multiplied by its share. The total uses only parts we can check. Missing parts stay unknown; they are not scored as zero.",
  },
  potential: {
    title: "Reviewer score",
    text: "A person rates six parts of your business from 0 to 4 using reasons and sources. The total appears only after all six have current ratings. This is their judgement, not a promise of a loan or business success.",
  },
  risk: {
    title: "Money concerns",
    text: "This checks possible money problems in the figures you shared. Lower is fewer concerns; higher is more concerns. It is a rule-based check, not the chance your business will fail. Missing figures stay unknown.",
  },
  riskCoverage: {
    title: "Money checks possible",
    text: "This is the share of money checks that have enough figures. We need at least 50% to show a money-concern score. More checks possible does not mean the business is safer.",
  },
  surplus: {
    title: "Money left each month",
    text: "Expected monthly sales minus monthly running costs. For example, sales of 20000 rupees minus costs of 12000 leaves 8000. Tax, your own pay and loan payments may still need to be paid. This is not guaranteed profit.",
  },
  margin: {
    title: "Money left from sales",
    text: "This is money left after running costs, as a percentage of sales. For example, 20% means 20 rupees left from each 100 rupees sold. Tax, your pay and loan payments may still need to be paid.",
  },
  fundingGap: {
    title: "Starting money still missing",
    text: "Starting cost minus your own money minus the money you plan to get from others. A positive number means a shortfall. A negative number means the plan lists more money than the starting cost. Planned money is not money already approved.",
  },
  stress: {
    title: "Money left if sales fall",
    text: "This is a what-if check using 20% lower sales and 10% higher running costs. It shows how less income could affect the plan. It is an example, not a forecast.",
  },
  median: {
    title: "Middle score in this group",
    text: "Put the known scores in order. This shows the middle score, or the average of the middle two. Missing scores are left out. A small group cannot show how all businesses will perform.",
  },
  comparison: {
    title: "Ideas we can compare",
    text: "These ideas have a score, at least 70% of the score areas available, and the same scoring rules. The comparison is about information supplied, not which business will succeed.",
  },
  form: {
    title: "Form details filled in",
    text: "This counts boxes you filled in. It is not your details score. You can leave optional answers blank when you do not know them.",
  },
  similarity: {
    title: "Similar wording",
    text: "This shows overlap in the words or meaning of two ideas. It helps you find related ideas. It does not prove that the businesses are the same or equally good.",
  },
  sourceCheck: {
    title: "Sources checked",
    text: "This counts original passages a reviewer compared with the transcript or translation. It checks that the wording matches the source. It does not prove the business claims are true.",
  },
  macroF1: {
    title: "Answer-check test score",
    text: "This test balances two things: finding the right answer type and avoiding wrong flags. It averages the result for each answer type equally. Higher is better on this test, but a small test does not prove the model works well for everyone.",
  },
  recall: {
    title: "Off-topic answers caught",
    text: "Of the off-topic answers in the test, this is the share the model spotted. For example, 80% means it caught 8 out of 10. It does not show how many good answers were wrongly flagged.",
  },
  evaluationCoverage: {
    title: "Test answers the model checked",
    text: "This is the share of test answers where the model gave a result. The rest were left for human review. It is not the share of correct results.",
  },
  abstention: {
    title: "Answers left for a person",
    text: "This is the share of test answers where the model did not give a result because it was unsure. A person should check those answers. A lower value alone does not mean a better model.",
  },
  training: {
    title: "Training examples saved",
    text: "These counts check whether enough reviewed answers and separate business groups are saved to start training. Repeated translations of the same business do not count as separate businesses. More examples alone do not prove better accuracy.",
  },
  submitted: {
    title: "Ideas submitted",
    text: "This counts saved ideas in the current view. It includes ideas still being read or waiting for a review.",
  },
  scored: {
    title: "Ideas with a details score",
    text: "This counts ideas with enough clear information to show a details score. It does not mean a reviewer has approved the business.",
  },
  missing: {
    title: "Ideas needing answers",
    text: "This counts ideas with at least one missing or unclear answer. Adding details helps a reviewer understand the plan; it does not guarantee a higher score.",
  },
  average: {
    title: "Average details added",
    text: "This adds the main-detail percentages for ideas in this view and divides by the number of ideas. Ideas without a check yet count as zero here. This is a group summary, not a business-success score.",
  },
  riskFactor: {
    title: "Money-concern points",
    text: "These points go from 0 to 4. Here, 0 means the rule found no concern, and 4 means more concern. This is different from a reviewer rating, where a higher score is better. Each rule counts for a set share of the money-concern total.",
  },
  monthlySales: {
    title: "Expected monthly sales",
    text: "This is the money you expect customers to pay in a month, before costs. It is an estimate, not money already earned and not profit.",
  },
  monthlyCosts: {
    title: "Monthly running costs",
    text: "This is what you expect to spend each month, such as rent, supplies, staff pay, electricity and travel. Include all costs you know. A blank answer means unknown, not zero.",
  },
  startingCost: {
    title: "Money needed to start",
    text: "This is the total amount needed to set up the business. List what it will pay for, such as tools, stock or a shop deposit. It is separate from expected monthly running costs.",
  },
  ownMoney: {
    title: "Your own money",
    text: "This is the amount you plan to put into the business yourself. Enter zero only if you will put in no money. Leave it unknown if you have not decided.",
  },
  borrowing: {
    title: "Money needed from others",
    text: "This is the amount you plan to get from a lender or another source. It does not mean the money has been approved or received. A loan must be repaid.",
  },
  unitPrice: {
    title: "Price for one item or service",
    text: "This is the price a customer will pay for one item or service. Include what the price covers, such as one meal, one garment or one hour. It is not your total monthly sales.",
  },
  medianCompleteness: {
    title: "Middle share of details added",
    text: "Put the main-detail percentages for this group in order. This shows the middle value, or the average of the middle two. An idea with no check yet counts as zero here. It is separate from the group details score.",
  },
  medianPotential: {
    title: "Middle reviewer score",
    text: "This is the middle score among ideas with all six current reviewer ratings. Unknown scores are left out. It is a summary of reviewer opinions, not a prediction of business success.",
  },
  medianDimension: {
    title: "Middle part score",
    text: "This is the middle automatic score for this part among ideas we can compare. It describes the details supplied. It does not rate which business is better.",
  },
processing:{title:'Ideas being read',text:'These ideas are waiting for the AI or are being read now. The original is saved. There is no need to send the same idea again.'},
assessed:{title:'Ideas with a first check',text:'These ideas have an automatic check. Some may still have missing answers or no total score. A first check is not an approval.'},
} as const;
export type HelpTopic = keyof typeof SCORE_HELP;
export const DIMENSION_HELP: Record<string, string> = {
  clarity: "Does your idea clearly say what you will sell and who will buy it?",
  customer_need:
    "Have you described the customer problem and what you learned from customers?",
  market_potential:
    "Have you shared customer details, research, a price and expected monthly sales? This automatic check does not prove that people will buy.",
  feasibility:
    "Have you listed the tools, suppliers, starting money and skills needed to run the business?",
  competition:
    "Have you described similar businesses and where you plan to work?",
  differentiation:
    "Have you explained what makes your offer different from other options?",
  completeness:
    "This is your main-detail percentage turned into a rounded score out of 4. It counts 14 main details. It is shown separately and adds no points to the total details score.",
};
export const AUTOMATIC_SCALE =
  "For automatic checks, 1 means a few details, 2 means some details, and 3 means most or all details. The app does not give 4 for business quality. No score means we need more information. These points rate the information, not the business.";
export const REVIEWER_SCALE =
  "This is a person's rating: 0 means a major concern, 1 means a weak case, 2 means it could work, 3 means it looks promising, and 4 means a strong case. Read their reason and sources. These are review opinions, not a prediction of success.";

export const FIELD_METRIC_HELP: Partial<
  Record<import("./types.js").FieldKey, HelpTopic>
> = {
  investment: "startingCost",
  selfInvestment: "ownMoney",
  loan: "borrowing",
  unitPrice: "unitPrice",
  monthlyRevenue: "monthlySales",
  monthlyCosts: "monthlyCosts",
};

export const FIELD_KEYS = [
  "businessName",
  "trade",
  "sector",
  "products",
  "customers",
  "problem",
  "location",
  "materials",
  "suppliers",
  "investment",
  "selfInvestment",
  "loan",
  "unitPrice",
  "monthlyRevenue",
  "monthlyCosts",
  "research",
  "competition",
  "differentiation",
  "experience",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];
export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: "entrepreneur" | "assessor";
}
export interface DashboardSummary {
  scope: "personal" | "programme";
  total: number;
  processing: number;
  assessed: number;
  scored?: number;
  meanCompleteness?: number;
  awaitingReview: number;
  needsClarification: number;
  failed: number;
  meanScore: number | null;
  latestScore: number | null;
  latestCompleteness: number | null;
  latestSubmissionId: string | null;
}
export const FIELD_LABELS: Record<FieldKey, string> = {
  businessName: "Business idea",
  trade: "Trade",
  sector: "Sector",
  products: "Products & services",
  customers: "Target customers",
  problem: "Customer problem",
  location: "Business location",
  materials: "Materials & equipment",
  suppliers: "Suppliers",
  investment: "Investment required",
  selfInvestment: "Own investment",
  loan: "Funding needed",
  unitPrice: "Product / service price",
  monthlyRevenue: "Projected monthly sales",
  monthlyCosts: "Monthly costs",
  research: "Market research",
  competition: "Competition",
  differentiation: "Differentiation",
  experience: "Relevant experience",
};
export const LANGUAGES = [
  { code: "auto", label: "Detect language" },
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी · Hindi" },
  { code: "mr-IN", label: "मराठी · Marathi" },
  { code: "te-IN", label: "తెలుగు · Telugu" },
  { code: "bn-IN", label: "বাংলা · Bengali" },
  { code: "od-IN", label: "ଓଡ଼ିଆ · Odia" },
];
export type EvidenceStatus =
  "supported" | "missing" | "ambiguous" | "irrelevant";
export interface EvidenceField {
  key: FieldKey;
  value: string | null;
  status: EvidenceStatus;
  evidenceIds: string[];
  reason: string;
}
export interface SourceSegment {
  id: string;
  originalText: string;
  englishText: string;
  page: number | null;
  startSeconds: number | null;
  endSeconds: number | null;
  kind: "text" | "pdf" | "audio" | "clarification";
  verified: boolean;
  clarificationId?: string;
}
export interface Dimension {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  evidenceIds: string[];
  explanation: string;
}
export interface RepairQuestion {
  id: string;
  field: FieldKey;
  question: string;
  translatedQuestion?: string;
  reason: string;
}
export interface Assessment {
  version: number;
  createdAt: string;
  rubricVersion: string;
  fields: EvidenceField[];
  segments: SourceSegment[];
  dimensions: Dimension[];
  score: number | null;
  coverage: number;
  completeness: number;
  reviewRequired: boolean;
  strengths: string[];
  gaps: string[];
  questions: RepairQuestion[];
  warnings: string[];
  language: string;
  providerModel: string;
  classifier: {
    status: "not_configured" | "available" | "unavailable";
    flags: { field: string; score: number }[];
    modelVersion?: string;
  };
}
export type SubmissionStatus =
  "queued" | "processing" | "ready" | "needs_review" | "failed";
export interface Submission {
  id: string;
  beneficiaryName: string;
  title: string;
  inputType: "text" | "pdf" | "audio";
  language: string;
  cohortId: string | null;
  cohortName: string | null;
  cohortSynthetic?: boolean;
  status: SubmissionStatus;
  stage: string;
  createdAt: string;
  updatedAt: string;
  fileName: string | null;
  fileMime: string | null;
  originalText: string | null;
  assessment: Assessment | null;
  history: Assessment[];
  review: {
    decision: string;
    note: string;
    reviewedAt: string;
    nextAction?: string;
    reasonCodes?: string[];
    evidenceIds?: string[];
    sourceReviewed?: boolean;
    assessorId?: string;
    assessmentVersion?: number;
    domainRatings?: import("./business-review.js").DomainRating[];
  } | null;
  error: string | null;
  errorCode?: string | null;
  nextRetryAt?: string | null;
  errorProvider?: "gemini" | "groq" | "cloud" | null;
  example?: boolean;
}
export interface Cohort {
  id: string;
  name: string;
  synthetic: boolean;
}
export interface Health {
  places?: boolean;
  database: boolean;
  gemini: boolean;
  groq?: boolean;
  cloud?: boolean;
  sarvam: boolean;
  classifier: boolean;
  examples: boolean;
  maxUploadMb: number;
  audioProvider: string;
}
export interface Session {
  user: WorkspaceUser | null;
  health: Health;
}
export interface SimilarIdea {
  submission: Submission;
  similarity: number;
  method: "embedding" | "keyword";
  matchedTerms: string[];
}
export interface LocalBusiness {
  provider?: "geoapify" | "openstreetmap";
  providerPlaceId?: string;
  address?: string;
  sourceLabel?: string;
  id: string;
  name: string;
  category: string;
  distanceMeters: number;
  url: string;
  lat: number;
  lon: number;
}
export interface LocalInsights {
  status: "available" | "unavailable";
  businesses: LocalBusiness[];
  retrievedAt: string;
  radiusMeters: number;
  attribution: string;
  message: string;
  truncated?: boolean;
  category?: string;
  center?: { lat: number; lon: number };
  sourceEndpoint?: string;
  cached?: boolean;
  stale?: boolean;
}

export interface MapPlace {
  name: string;
  lat: number;
  lon: number;
}
export interface LocalObservation {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  sourceUrl: string;
  note: string;
  checked: boolean;
  recordedAt: string;
}
export interface SavedLocalContext {
  place: MapPlace | null;
  category: string;
  radius: number;
  observations: LocalObservation[];
  revision: number;
}

export interface ScreeningSummary {
  action:
    | "clarification"
    | "financial_mentoring"
    | "skills_review"
    | "deeper_evaluation";
  label: string;
  reasons: { text: string; evidenceIds: string[] }[];
  priorityFields: FieldKey[];
  domains: {
    key: string;
    label: string;
    status: "missing" | "described" | "concern" | "not_validated";
    explanation: string;
    evidenceIds: string[];
  }[];
}

export interface RiskFactor {
  key: string;
  label: string;
  weight: number;
  points: number | null;
  explanation: string;
  evidenceIds: string[];
}
export interface AssessorSupport {
  screening: ScreeningSummary;
  version: string;
  assessmentVersion: number;
  risk: {
    score: number | null;
    band: "lower" | "moderate" | "higher" | "insufficient_data";
    coverage: number;
    factors: RiskFactor[];
    explanation: string;
  };
  financials: {
    monthlySales: number | null;
    monthlyCosts: number | null;
    monthlySurplus: number | null;
    marginPercent: number | null;
    investment: number | null;
    ownInvestment: number | null;
    requestedFunding: number | null;
    fundingPlanGap: number | null;
    stressedSurplus: number | null;
    evidenceIds: string[];
  };
  evidence: {
    supported: number;
    total: number;
    conflicts: number;
    verifiedSegments: number;
    totalSegments: number;
  };
  followUps: { title: string; detail: string; fields: FieldKey[] }[];
}

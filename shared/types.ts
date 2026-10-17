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
  review: { decision: string; note: string; reviewedAt: string } | null;
  error: string | null;
  example?: boolean;
}
export interface Cohort {
  id: string;
  name: string;
  synthetic: boolean;
}
export interface Health {
  database: boolean;
  gemini: boolean;
  sarvam: boolean;
  classifier: boolean;
  examples: boolean;
  maxUploadMb: number;
  audioProvider: string;
}
export interface Session {
  user: { id: string; name: string; email: string } | null;
  health: Health;
}
export interface SimilarIdea {
  submission: Submission;
  similarity: number;
  method: "embedding" | "keyword";
  matchedTerms: string[];
}
export interface LocalBusiness {
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
}

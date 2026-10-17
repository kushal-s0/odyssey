import mongoose, { Schema } from "mongoose";
import { config } from "./config.js";
const flexible = { strict: false, timestamps: true };
const submissionSchema = new Schema(
  {
    beneficiaryName: String,
    title: String,
    inputType: String,
    language: String,
    cohortId: String,
    cohortName: String,
    cohortSynthetic: Boolean,
    status: String,
    stage: String,
    fileId: Schema.Types.ObjectId,
    fileName: String,
    fileMime: String,
    fileHash: String,
    originalText: String,
    assessment: Schema.Types.Mixed,
    history: [Schema.Types.Mixed],
    review: Schema.Types.Mixed,
    error: String,
    embedding: [Number],
    embeddingModel: String,
    sourceFamily: String,
  },
  flexible,
);
submissionSchema.index({ createdAt: -1 });
submissionSchema.index({ status: 1 });
export const SubmissionModel = mongoose.model("Submission", submissionSchema);
export const CohortModel = mongoose.model(
  "Cohort",
  new Schema(
    {
      name: { type: String, required: true, unique: true },
      synthetic: { type: Boolean, default: false },
    },
    flexible,
  ),
);
export const UserModel = mongoose.model(
  "User",
  new Schema(
    {
      email: { type: String, unique: true },
      name: String,
      passwordHash: String,
      role: { type: String, default: "assessor" },
    },
    flexible,
  ),
);
export const SessionModel = mongoose.model(
  "Session",
  new Schema(
    {
      tokenHash: { type: String, unique: true },
      userId: Schema.Types.ObjectId,
      expiresAt: { type: Date, index: { expires: 0 } },
    },
    flexible,
  ),
);
const jobSchema = new Schema(
  {
    submissionId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, default: "queued" },
    attempts: { type: Number, default: 0 },
    leaseUntil: Date,
    leaseToken: String,
    runAt: { type: Date, default: Date.now },
    error: String,
  },
  flexible,
);
jobSchema.index({ status: 1, runAt: 1, leaseUntil: 1 });
export const JobModel = mongoose.model("Job", jobSchema);
export const AuditModel = mongoose.model(
  "Audit",
  new Schema(
    {
      submissionId: Schema.Types.ObjectId,
      userId: String,
      action: String,
      details: Schema.Types.Mixed,
    },
    flexible,
  ),
);
export const CacheModel = mongoose.model(
  "Cache",
  new Schema(
    {
      key: { type: String, unique: true },
      value: Schema.Types.Mixed,
      expiresAt: { type: Date, index: { expires: 0 } },
    },
    flexible,
  ),
);
export const ClarificationModel = mongoose.model(
  "Clarification",
  new Schema(
    {
      submissionId: Schema.Types.ObjectId,
      field: String,
      originalText: String,
      fileId: Schema.Types.ObjectId,
      fileName: String,
      fileMime: String,
      status: { type: String, default: "received" },
      assessmentVersion: Number,
    },
    flexible,
  ),
);
export const AnnotationModel = mongoose.model(
  "Annotation",
  new Schema(
    {
      submissionId: Schema.Types.ObjectId,
      field: String,
      businessContext: String,
      question: String,
      answer: String,
      label: { type: Number, enum: [0, 1] },
      groupId: String,
      language: String,
      reviewer: String,
    },
    flexible,
  ),
);
AnnotationModel.schema.index({ submissionId: 1, field: 1 }, { unique: true });
export let bucket: mongoose.mongo.GridFSBucket;
export const databaseReady = () => mongoose.connection.readyState === 1;
export async function connectDatabase() {
  if (!config.MONGODB_URI) return false;
  if (!config.MONGODB_URI.startsWith("mongodb+srv://"))
    throw new Error("Use a MongoDB Atlas mongodb+srv:// connection URI.");
  if (config.SESSION_SECRET.length < 32)
    throw new Error("SESSION_SECRET must have at least 32 characters.");
  await mongoose.connect(config.MONGODB_URI, {
    dbName: config.MONGODB_DB,
    serverSelectionTimeoutMS: 10000,
  });
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, {
    bucketName: "sources",
  });
  await Promise.all([
    SubmissionModel.init(),
    CohortModel.init(),
    UserModel.init(),
    SessionModel.init(),
    JobModel.init(),
    CacheModel.init(),
    AnnotationModel.init(),
  ]);
  return true;
}
export function serializeSubmission(doc: any) {
  const item = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const {
    _id,
    __v,
    fileId,
    fileHash,
    embedding,
    embeddingModel,
    sourceFamily,
    ...safe
  } = item;
  return {
    ...safe,
    id: String(_id),
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString(),
    history: item.history ?? [],
    review: item.review ?? null,
    assessment: item.assessment ?? null,
    error: item.error ?? null,
  };
}
export async function saveFile(
  buffer: Buffer,
  name: string,
  mime: string,
): Promise<mongoose.Types.ObjectId> {
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(name, { metadata: { mime } });
    stream.on("error", reject);
    stream.on("finish", () => resolve(stream.id));
    stream.end(buffer);
  });
}
export async function readFile(id: mongoose.Types.ObjectId): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of bucket.openDownloadStream(id)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

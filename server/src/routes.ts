import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { config, health } from "./config.js";
import {
  databaseReady,
  SubmissionModel,
  CohortModel,
  JobModel,
  AuditModel,
  SessionModel,
  AnnotationModel,
  ClarificationModel,
  serializeSubmission,
  saveFile,
  bucket,
} from "./db.js";
import {
  requireAccount,
  requireAssessor,
  sessionUser,
  login,
  register,
  digest,
  submissionScope,
} from "./auth.js";
import {
  submissionSchema,
  serializeGuidedIdea,
  assessorReviewSchema,
  reviewEvidenceError,
  LANGUAGE_CODES,
  textInput,
} from "../../shared/input-rules.js";
import { examples, exampleCohorts } from "./examples.js";
import { assess, cosine, fieldValue } from "./domain/assessment.js";
import {
  readSource,
  extractFieldsWithProvider,
  translateQuestions,
} from "./providers/gemini.js";
import { geocode, localBusinesses } from "./providers/location.js";
import { applyClassifier } from "./providers/classifier.js";
import { dashboardSummary } from "./domain/dashboard.js";
import {
  FIELD_KEYS,
  FIELD_LABELS,
  type Assessment,
  type SourceSegment,
  type Submission,
} from "../../shared/types.js";
export const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
    fields: 12,
    fieldSize: 30000,
  },
});
const id = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), "Invalid record ID.");
const writableRate = rateLimit({
  windowMs: 60000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
router.get("/health", (_req, res) =>
  res.json({ ...health(), database: databaseReady() }),
);
router.get("/session", async (req, res) =>
  res.json({
    user: await sessionUser(req),
    health: { ...health(), database: databaseReady() },
  }),
);
router.post(
  "/auth/login",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 15,
    message: {
      error: "Too many sign-in attempts. Please try again later.",
      code: "LOGIN_RATE_LIMITED",
    },
  }),
  login,
);
router.post(
  "/auth/register",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 5,
    message: {
      error: "Too many account creation attempts. Please try again later.",
      code: "REGISTRATION_RATE_LIMITED",
    },
  }),
  register,
);
router.post("/auth/logout", async (req, res) => {
  if (databaseReady() && req.cookies?.strive_session)
    await SessionModel.deleteOne({
      tokenHash: digest(req.cookies.strive_session),
    });
  res.clearCookie("strive_session", { path: "/" });
  res.json({ ok: true });
});
router.get("/examples", (_req, res) =>
  config.ENABLE_EXAMPLES
    ? res.json({ submissions: examples, cohorts: exampleCohorts })
    : res.status(404).json({ error: "Examples are disabled." }),
);
router.use(requireAccount);
router.get("/dashboard", async (req, res) =>
  res.json({ summary: await dashboardSummary(req.actor!) }),
);
router.use("/training", requireAssessor);
router.use("/locations", requireAssessor);
router.get("/cohorts", requireAssessor, async (_req, res) =>
  res.json({
    cohorts: (await CohortModel.find().sort({ name: 1 }).lean()).map((c) => ({
      id: String(c._id),
      name: c.name,
      synthetic: !!c.synthetic,
    })),
  }),
);
router.post("/cohorts", requireAssessor, async (req, res) => {
  const name = z.string().trim().min(2).max(100).parse(req.body.name);
  const cohort = await CohortModel.create({ name, synthetic: false });
  res
    .status(201)
    .json({ id: String(cohort._id), name: cohort.name, synthetic: false });
});
router.get("/submissions", async (req, res) => {
  const filter: Record<string, unknown> = { ...submissionScope(req.actor!) };
  if (typeof req.query.cohort === "string" && req.query.cohort)
    filter.cohortId = id.parse(req.query.cohort);
  const records = await SubmissionModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .select("-embedding")
    .lean();
  res.json({ submissions: records.map(serializeSubmission), limit: 500 });
});
async function validateFile(file: Express.Multer.File, type: string) {
  const b = file.buffer;
  const ascii = b.subarray(0, 12).toString("ascii");
  let mime: string | null = null;
  if (ascii.startsWith("%PDF-")) mime = "application/pdf";
  else if (b.subarray(4, 8).toString() === "ftyp") mime = "video/mp4";
  else if (ascii.startsWith("OggS")) mime = "audio/ogg";
  else if (ascii.startsWith("RIFF") && b.subarray(8, 12).toString() === "WAVE")
    mime = "audio/wav";
  else if (
    ascii.startsWith("ID3") ||
    (b[0] === 255 && ((b[1] ?? 0) & 224) === 224)
  )
    mime = "audio/mpeg";
  else if (b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
    mime = "audio/webm";
  else if (ascii.startsWith("fLaC")) mime = "audio/flac";
  if (
    !mime ||
    (type === "pdf" && mime !== "application/pdf") ||
    (type === "audio" && mime === "application/pdf")
  )
    throw Object.assign(
      new Error(
        "The file content does not match a supported PDF or recording format.",
      ),
      { status: 400 },
    );
  if (type === "pdf") {
    try {
      const document = await PDFDocument.load(b);
      if (document.getPageCount() > 25)
        throw new Error("PDFs are limited to 25 pages.");
    } catch (e) {
      throw Object.assign(
        new Error(e instanceof Error ? e.message : "Invalid PDF."),
        { status: 400 },
      );
    }
  }
  return mime;
}
router.post(
  "/submissions",
  writableRate,
  upload.single("file"),
  async (req, res) => {
    const data = submissionSchema.parse(req.body);
    if (data.submissionFormat === "guided" && data.structuredInput)
      data.originalText = serializeGuidedIdea(data.title, data.structuredInput);
    if (
      req.actor!.role === "entrepreneur" &&
      data.beneficiaryName !== req.actor!.name
    )
      throw Object.assign(
        new Error("Submit under the name on your entrepreneur account."),
        { status: 400 },
      );
    if (
      data.inputType === "text" &&
      (!data.originalText || data.originalText.length < 20)
    )
      throw Object.assign(
        new Error("Describe your business idea in at least 20 characters."),
        { status: 400 },
      );
    if (data.inputType !== "text" && !req.file)
      throw Object.assign(new Error("Upload a PDF or recording."), {
        status: 400,
      });
    if (data.inputType === "text" && req.file)
      throw Object.assign(
        new Error("Text submissions cannot include a file."),
        { status: 400 },
      );
    let cohort: any = null;
    if (data.cohortId) {
      if (req.actor!.role !== "assessor")
        throw Object.assign(
          new Error("Programme cohorts are assigned by an assessor."),
          { status: 403 },
        );
      cohort = await CohortModel.findById(id.parse(data.cohortId));
      if (!cohort)
        throw Object.assign(new Error("Cohort not found."), { status: 400 });
    }
    let fileId: mongoose.Types.ObjectId | undefined;
    let fileMime: string | undefined;
    if (req.file) {
      fileMime = await validateFile(req.file, data.inputType);
      fileId = await saveFile(
        req.file.buffer,
        req.file.originalname.replace(/[\r\n\\/]/g, "_").slice(0, 180),
        fileMime,
      );
    }
    let record: any;
    try {
      record = await SubmissionModel.create({
        ...data,
        ownerId: req.actor!.id,
        submissionFormat:
          data.submissionFormat ??
          (data.inputType === "text" ? "free_text" : "upload"),
        cohortId: cohort ? String(cohort._id) : null,
        cohortName: cohort?.name ?? null,
        cohortSynthetic: !!cohort?.synthetic,
        fileId,
        fileName:
          req.file?.originalname.replace(/[\r\n\\/]/g, "_").slice(0, 180) ??
          null,
        fileMime: fileMime ?? null,
        fileHash: req.file
          ? createHash("sha256").update(req.file.buffer).digest("hex")
          : null,
        status: "queued",
        stage: "Waiting to process",
        history: [],
      });
      await JobModel.create({ submissionId: record._id });
    } catch (error) {
      if (record) await SubmissionModel.deleteOne({ _id: record._id });
      if (fileId) await bucket.delete(fileId).catch(() => {});
      throw error;
    }
    await AuditModel.create({
      submissionId: record._id,
      userId: req.actor!.id,
      action: "submission.created",
    });
    res.status(202).json({ submission: serializeSubmission(record) });
  },
);
router.get("/submissions/:id", async (req, res) => {
  const doc = await SubmissionModel.findOne({
    _id: id.parse(req.params.id),
    ...submissionScope(req.actor!),
  });
  if (!doc) {
    res.status(404).json({ error: "Submission not found." });
    return;
  }
  res.json({ submission: serializeSubmission(doc) });
});
router.get("/submissions/:id/source", async (req, res) => {
  const doc = await SubmissionModel.findOne({
    _id: id.parse(req.params.id),
    ...submissionScope(req.actor!),
  });
  if (!doc?.fileId) {
    res.status(404).json({ error: "No uploaded source file." });
    return;
  }
  const files = await bucket.find({ _id: doc.fileId }).toArray();
  const file = files[0];
  if (!file) {
    res.status(404).json({ error: "Source file not found." });
    return;
  }
  const total = file.length;
  const range = req.headers.range;
  res.setHeader("Content-Type", doc.fileMime ?? "application/octet-stream");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName ?? "source")}`,
  );
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${total}`);
      res.end();
      return;
    }
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (start >= total || start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${total}`);
      res.end();
      return;
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    res.setHeader("Content-Length", end - start + 1);
    const stream = bucket.openDownloadStream(doc.fileId, {
      start,
      end: end + 1,
    });
    stream.on("error", () => res.destroy());
    stream.pipe(res);
    res.on("close", () => stream.destroy());
  } else {
    res.setHeader("Content-Length", total);
    const stream = bucket.openDownloadStream(doc.fileId);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
    res.on("close", () => stream.destroy());
  }
});
router.post("/submissions/:id/retry", writableRate, async (req, res) => {
  const record = await SubmissionModel.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      ...submissionScope(req.actor!),
      status: "failed",
    },
    {
      $set: {
        status: "queued",
        stage: "Waiting to retry",
        error: null,
        errorCode: null,
        errorProvider: null,
        nextRetryAt: null,
      },
    },
    { new: true },
  );
  if (!record) {
    res.status(409).json({ error: "Only failed submissions can be retried." });
    return;
  }
  const previousJob = await JobModel.findOneAndUpdate(
    {
      submissionId: record._id,
      status: "failed",
    },
    {
      $set: {
        status: "queued",
        attempts: 0,
        runAt: new Date(),
        error: null,
        errorCode: null,
        errorProvider: null,
      },
      $unset: { leaseToken: 1, leaseUntil: 1 },
    },
  );
  if (!previousJob) await JobModel.create({ submissionId: record._id });
  res.json({ submission: serializeSubmission(record) });
});
router.post(
  "/submissions/:id/clarifications",
  writableRate,
  upload.single("file"),
  async (req, res) => {
    const parsed = z
      .object({
        field: z.enum(FIELD_KEYS),
        answer: textInput("Clarification", 10, 2000).optional(),
        language: z.enum(LANGUAGE_CODES).default("auto"),
        version: z.coerce.number().int().min(1),
      })
      .strict()
      .parse(req.body);
    const record = await SubmissionModel.findOne({
      _id: id.parse(req.params.id),
      ...submissionScope(req.actor!),
    });
    if (!record?.assessment) {
      res
        .status(404)
        .json({ error: "An assessment is required before clarification." });
      return;
    }
    const current = record.assessment as Assessment;
    if (req.file && parsed.answer !== undefined)
      throw Object.assign(
        new Error("Choose either a written clarification or a recording."),
        { status: 400 },
      );
    if (current.version !== parsed.version) {
      res.status(409).json({
        error:
          "This assessment has changed. Refresh before adding clarification.",
      });
      return;
    }
    if (!current.questions.some((question) => question.field === parsed.field))
      throw Object.assign(
        new Error("Choose one of the current clarification questions."),
        { status: 400 },
      );
    if (!req.file && (!parsed.answer || parsed.answer.length < 2))
      throw Object.assign(new Error("Enter or record your clarification."), {
        status: 400,
      });
    let language = current.language;
    let sourceModel = current.providerModel;
    let segments: SourceSegment[];
    const clarificationMime = req.file
      ? await validateFile(req.file, "audio")
      : null;
    const clarificationFileId = req.file
      ? await saveFile(
          req.file.buffer,
          req.file.originalname,
          clarificationMime!,
        )
      : null;
    const clarification = await ClarificationModel.create({
      submissionId: record._id,
      field: parsed.field,
      originalText: parsed.answer ?? null,
      fileId: clarificationFileId,
      fileName: req.file?.originalname ?? null,
      fileMime: clarificationMime,
      status: "received",
    });
    if (req.file) {
      const { transcribe } = await import("./providers/audio.js");
      const original = await transcribe(req.file.buffer, parsed.language);
      const translated = await readSource({
        kind: "audio",
        audioSegments: original,
        language: parsed.language,
      });
      segments = translated.segments;
      language = translated.language;
      sourceModel = translated.providerModel;
    } else {
      const source = await readSource({
        text: parsed.answer,
        kind: "text",
        language: parsed.language,
      });
      segments = source.segments;
      language = source.language;
      sourceModel = source.providerModel;
    }
    const prefix = `v${current.version + 1}-`;
    segments = segments.map((s) => ({
      ...s,
      id: prefix + s.id,
      kind: "clarification",
      clarificationId: String(clarification._id),
    }));
    const extraction = await extractFieldsWithProvider(
      segments,
      FIELD_LABELS[parsed.field],
    );
    const replacement = extraction.fields.find((f) => f.key === parsed.field);
    if (!replacement || replacement.status !== "supported") {
      res.status(422).json({
        error:
          "The clarification did not establish a supported value for this field. Please add specific information.",
      });
      return;
    }
    const next = assess({
      fields: current.fields.map((f) =>
        f.key === parsed.field ? replacement : f,
      ),
      segments: [...current.segments, ...segments],
      language,
      providerModel: [
        ...new Set(
          [
            current.providerModel,
            sourceModel,
            extraction.providerModel,
          ].flatMap((model) => model.split(" + ")),
        ),
      ].join(" + "),
      version: current.version + 1,
    });
    const repaired = next.fields.find((f) => f.key === parsed.field);
    if (repaired?.status !== "supported") {
      res.status(422).json({
        error:
          "The clarification failed source validation. No existing assessment was changed.",
      });
      return;
    }
    await applyClassifier(next);
    try {
      const translations = await translateQuestions(next.questions, language);
      next.questions.forEach(
        (q) =>
          (q.translatedQuestion = translations.find(
            (t) => t.id === q.id,
          )?.translation),
      );
    } catch {
      /* English remains available. */
    }
    const updated = await SubmissionModel.findOneAndUpdate(
      {
        _id: record._id,
        ...submissionScope(req.actor!),
        "assessment.version": parsed.version,
      },
      {
        $set: {
          assessment: next,
          status: next.reviewRequired ? "needs_review" : "ready",
          review: null,
          embedding: [],
        },
        $push: { history: current },
      },
      { new: true },
    );
    if (!updated) {
      res.status(409).json({
        error:
          "Another reviewer changed this assessment. Refresh and try again.",
      });
      return;
    }
    await ClarificationModel.updateOne(
      { _id: clarification._id },
      { $set: { status: "applied", assessmentVersion: next.version } },
    );
    await AuditModel.create({
      submissionId: record._id,
      userId: req.actor!.id,
      action: "assessment.clarified",
      details: {
        field: parsed.field,
        from: current.version,
        to: next.version,
        oldScore: current.score,
        newScore: next.score,
      },
    });
    res.json({ submission: serializeSubmission(updated) });
  },
);
router.get(
  "/submissions/:id/clarifications/:clarificationId/source",
  async (req, res) => {
    if (
      !(await SubmissionModel.exists({
        _id: id.parse(req.params.id),
        ...submissionScope(req.actor!),
      }))
    ) {
      res.status(404).json({ error: "Submission not found." });
      return;
    }
    const source = await ClarificationModel.findOne({
      _id: id.parse(req.params.clarificationId),
      submissionId: id.parse(req.params.id),
    });
    if (!source) {
      res.status(404).json({ error: "Clarification source not found." });
      return;
    }
    if (!source.fileId) {
      res.type("text/plain").send(source.originalText ?? "");
      return;
    }
    res.setHeader(
      "Content-Type",
      source.fileMime ?? "application/octet-stream",
    );
    res.setHeader("Cache-Control", "private, no-store");
    const stream = bucket.openDownloadStream(source.fileId);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
    res.on("close", () => stream.destroy());
  },
);
router.post("/submissions/:id/verify", requireAssessor, async (req, res) => {
  const parsed = z
    .object({
      segmentIds: z.array(z.string()).min(1).max(150),
      version: z.number().int(),
    })
    .parse(req.body);
  const record = await SubmissionModel.findById(id.parse(req.params.id));
  if (!record?.assessment) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  const current = record.assessment as Assessment;
  const selected = new Set(parsed.segmentIds);
  if (parsed.segmentIds.some((i) => !current.segments.some((s) => s.id === i)))
    throw Object.assign(new Error("Unknown evidence segment."), {
      status: 400,
    });
  const next = assess({
    fields: current.fields,
    segments: current.segments.map((s) =>
      selected.has(s.id) ? { ...s, verified: true } : s,
    ),
    language: current.language,
    providerModel: current.providerModel,
    version: current.version + 1,
  });
  next.classifier = current.classifier;
  if (current.classifier.flags.length) next.reviewRequired = true;
  const updated = await SubmissionModel.findOneAndUpdate(
    { _id: record._id, "assessment.version": parsed.version },
    {
      $set: {
        assessment: next,
        status: next.reviewRequired ? "needs_review" : "ready",
        review: null,
      },
      $push: { history: current },
    },
    { new: true },
  );
  if (!updated) {
    res
      .status(409)
      .json({ error: "Assessment changed. Refresh and try again." });
    return;
  }
  await AuditModel.create({
    submissionId: record._id,
    userId: req.actor!.id,
    action: "evidence.verified",
    details: { segmentIds: parsed.segmentIds },
  });
  res.json({ submission: serializeSubmission(updated) });
});
router.post("/submissions/:id/review", requireAssessor, async (req, res) => {
  const data = assessorReviewSchema.parse(req.body);
  const previous = await SubmissionModel.findById(id.parse(req.params.id));
  if (!previous?.assessment) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  const evidenceError = reviewEvidenceError(
    data,
    previous.assessment as Assessment,
  );
  if (evidenceError) {
    res
      .status(data.version !== previous.assessment.version ? 409 : 400)
      .json({ error: evidenceError });
    return;
  }
  const record = await SubmissionModel.findOneAndUpdate(
    { _id: id.parse(req.params.id), "assessment.version": data.version },
    {
      $set: {
        review: {
          ...data,
          assessorId: req.actor!.id,
          assessmentVersion: data.version,
          reviewSchemaVersion: "assessor-review-v1",
          reviewedAt: new Date().toISOString(),
        },
      },
    },
    { new: true },
  );
  if (!record) {
    res.status(409).json({ error: "Assessment changed or was not found." });
    return;
  }
  await AuditModel.create({
    submissionId: record._id,
    userId: req.actor!.id,
    action: "assessment.reviewed",
    details: data,
  });
  res.json({ submission: serializeSubmission(record) });
});
const tokens = (s: string) =>
  new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
export function keywordSimilarity(a: Submission, b: Submission) {
  const content = (s: Submission) =>
    [
      s.title,
      ...(s.assessment?.fields ?? [])
        .filter((f) => ["products", "customers", "trade"].includes(f.key))
        .map((f) => f.value ?? ""),
    ].join(" ");
  const x = tokens(content(a)),
    y = tokens(content(b));
  const common = [...x].filter(
    (v) =>
      y.has(v) && !["the", "and", "for", "with", "local", "nearby"].includes(v),
  );
  return {
    score: common.length / Math.max(1, Math.sqrt(x.size * y.size)),
    common,
  };
}
router.get("/submissions/:id/similar", requireAssessor, async (req, res) => {
  const record = await SubmissionModel.findById(id.parse(req.params.id)).lean();
  if (!record) {
    res.status(404).json({ error: "Submission not found." });
    return;
  }
  const records = await SubmissionModel.find({
    _id: { $ne: record._id },
    assessment: { $ne: null },
    ...(record.sourceFamily
      ? { sourceFamily: { $ne: record.sourceFamily } }
      : {}),
  })
    .limit(500)
    .lean();
  const target = serializeSubmission(record) as Submission;
  const matches = records
    .filter((r) => !record.fileHash || r.fileHash !== record.fileHash)
    .map((r) => {
      const submission = serializeSubmission(r) as Submission;
      const keywords = keywordSimilarity(target, submission);
      const vectors =
        record.embedding?.length &&
        record.embeddingModel === r.embeddingModel &&
        record.embedding.length === r.embedding?.length;
      return {
        submission,
        similarity: vectors
          ? cosine(record.embedding!, r.embedding!)
          : keywords.score,
        method: vectors ? "embedding" : "keyword",
        matchedTerms: keywords.common.slice(0, 6),
      };
    })
    .filter((m) => m.similarity > 0.05)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);
  res.json({ matches });
});
router.get("/locations/search", async (req, res) => {
  const query = z.string().trim().min(3).max(250).parse(req.query.q);
  res.json({ locations: await geocode(query) });
});
router.post("/locations/businesses", writableRate, async (req, res) => {
  const p = z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      category: z.enum([
        "tailoring",
        "food",
        "dairy",
        "beauty",
        "repair",
        "agriculture",
        "poultry",
      ]),
      radius: z.number().int().min(500).max(5000).default(3000),
    })
    .parse(req.body);
  res.json(await localBusinesses(p.lat, p.lon, p.category, p.radius));
});
router.get("/training/annotations", async (_req, res) => {
  const rows = await AnnotationModel.find().sort({ createdAt: -1 }).lean();
  res.json({ annotations: rows.map((r) => ({ ...r, id: String(r._id) })) });
});
router.get("/training/model", async (_req, res) => {
  if (!config.MODEL_SERVICE_URL) {
    res.json({ ready: false, reason: "Not configured" });
    return;
  }
  try {
    const url = new URL(config.MODEL_SERVICE_URL);
    if (config.NODE_ENV === "production" && url.protocol !== "https:")
      throw new Error("HTTPS required");
    const response = await fetch(new URL("/health", url), {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Unavailable");
    const metadata: any = await response.json();
    res.json({
      ready: metadata.ready === true,
      modelVersion: metadata.modelVersion,
      embeddingModel: metadata.embeddingModel,
      dimension: metadata.dimension,
      featureVersion: metadata.featureVersion,
      metrics: metadata.metrics ?? null,
      advisoryOnly: true,
    });
  } catch {
    res.json({ ready: false, reason: "Endpoint unavailable" });
  }
});
router.post("/training/annotations", async (req, res) => {
  const input = z
    .object({
      submissionId: z.string(),
      field: z.enum(FIELD_KEYS),
      label: z.union([z.literal(0), z.literal(1)]),
      groupId: z.string().trim().min(2).max(100),
    })
    .parse(req.body);
  const record = await SubmissionModel.findById(id.parse(input.submissionId));
  if (!record?.assessment) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  const a = record.assessment as Assessment;
  const f = a.fields.find((f) => f.key === input.field);
  const source = f?.evidenceIds
    .map((i) => a.segments.find((s) => s.id === i)?.englishText ?? "")
    .join(" ");
  if (!source)
    throw Object.assign(
      new Error("This answer has no source evidence to annotate."),
      { status: 400 },
    );
  const row = await AnnotationModel.findOneAndUpdate(
    { submissionId: record._id, field: input.field },
    {
      $set: {
        ...input,
        businessContext: [
          fieldValue(a, "businessName"),
          fieldValue(a, "products"),
        ]
          .filter(Boolean)
          .join(" "),
        question: FIELD_LABELS[input.field],
        answer: f?.value ?? source,
        language: a.language,
        reviewer: req.actor!.id,
      },
    },
    { upsert: true, new: true },
  );
  res.status(201).json({ id: String(row._id) });
});

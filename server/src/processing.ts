import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { config } from "./config.js";
import { JobModel, SubmissionModel, readFile, databaseReady } from "./db.js";
import { assess, fieldValue } from "./domain/assessment.js";
import {
  readSource,
  extractFields,
  translateQuestions,
  embed,
  ProviderError,
} from "./providers/gemini.js";
import { transcribe } from "./providers/audio.js";
import { applyClassifier } from "./providers/classifier.js";
import type { Assessment } from "../../shared/types.js";
export async function buildAssessment(input: {
  text?: string;
  buffer?: Buffer;
  mime?: string;
  kind: "text" | "pdf" | "audio";
  language: string;
  version?: number;
}): Promise<{ assessment: Assessment; embedding: number[] | null }> {
  let pageCount: number | undefined;
  if (input.kind === "pdf") {
    try {
      const pdf = await PDFDocument.load(input.buffer!, {
        ignoreEncryption: false,
      });
      pageCount = pdf.getPageCount();
      if (pageCount > 25)
        throw new ProviderError(
          "PDFs are limited to 25 pages. Split the document before uploading.",
        );
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        "The PDF is encrypted, damaged, or unreadable. Upload an unlocked PDF.",
      );
    }
  }
  const audioSegments =
    input.kind === "audio" && config.AUDIO_PROVIDER === "sarvam"
      ? await transcribe(input.buffer!, input.language)
      : undefined;
  const source = await readSource({
    ...input,
    buffer: audioSegments ? undefined : input.buffer,
    pageCount,
    audioSegments,
  });
  const fields = await extractFields(source.segments);
  const assessment = assess({
    fields,
    segments: source.segments,
    language: source.language,
    providerModel: config.GEMINI_MODEL,
    version: input.version,
    warnings: source.warnings,
  });
  try {
    const translated = await translateQuestions(
      assessment.questions,
      source.language,
    );
    assessment.questions.forEach((q) => {
      q.translatedQuestion = translated.find((t) => t.id === q.id)?.translation;
    });
  } catch {
    assessment.warnings.push(
      "Clarification questions could not be translated. English questions are available.",
    );
  }
  await applyClassifier(assessment);
  let embedding: number[] | null = null;
  const content = [
    "businessName",
    "products",
    "customers",
    "problem",
    "location",
  ]
    .map((k) => fieldValue(assessment, k as any))
    .filter(Boolean)
    .join("\n");
  if (content)
    try {
      embedding = await embed(content);
    } catch {
      assessment.warnings.push(
        "Semantic similarity is temporarily unavailable. Keyword matches remain available.",
      );
    }
  return { assessment, embedding };
}
let running = 0;
let ticking = false;
let timer: ReturnType<typeof setInterval> | null = null;
export function startWorker() {
  if (timer) return;
  timer = setInterval(() => {
    void tick().catch((error) =>
      console.error("Processing worker:", error.message),
    );
  }, 1800);
  timer.unref();
  void tick();
}
export function stopWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
async function tick() {
  if (ticking || !databaseReady()) return;
  ticking = true;
  try {
    const exhausted = await JobModel.find({
      status: "processing",
      attempts: { $gte: 3 },
      leaseUntil: { $lt: new Date() },
    })
      .select("_id submissionId")
      .lean();
    for (const stale of exhausted) {
      const claimed = await JobModel.updateOne(
        {
          _id: stale._id,
          status: "processing",
          leaseUntil: { $lt: new Date() },
        },
        {
          $set: {
            status: "failed",
            error: "Processing was interrupted after three attempts.",
          },
        },
      );
      if (claimed.modifiedCount)
        await SubmissionModel.updateOne(
          { _id: stale.submissionId, status: "processing" },
          {
            $set: {
              status: "failed",
              stage: "Needs attention",
              error: "Processing was interrupted. Review the source and retry.",
            },
          },
        );
    }
    while (running < config.PROCESSING_CONCURRENCY) {
      const token = randomUUID();
      const now = new Date();
      const job = await JobModel.findOneAndUpdate(
        {
          attempts: { $lt: 3 },
          $or: [
            { status: "queued", runAt: { $lte: now } },
            { status: "processing", leaseUntil: { $lt: now } },
          ],
        },
        {
          $set: {
            status: "processing",
            leaseUntil: new Date(Date.now() + 180000),
            leaseToken: token,
          },
          $inc: { attempts: 1 },
        },
        { sort: { createdAt: 1 }, new: true },
      );
      if (!job) break;
      running++;
      void processJob(job, token).finally(() => {
        running--;
      });
    }
  } finally {
    ticking = false;
  }
}
async function processJob(job: any, token: string) {
  const heartbeat = setInterval(() => {
    void JobModel.updateOne(
      { _id: job._id, leaseToken: token, status: "processing" },
      { $set: { leaseUntil: new Date(Date.now() + 180000) } },
    ).catch(() => {});
  }, 30000);
  heartbeat.unref();
  try {
    const submission = await SubmissionModel.findById(job.submissionId);
    if (!submission) throw new ProviderError("Submission no longer exists.");
    await SubmissionModel.updateOne(
      { _id: submission._id },
      {
        $set: {
          status: "processing",
          stage:
            submission.inputType === "audio"
              ? "Transcribing recording"
              : "Reading source evidence",
          error: null,
        },
      },
    );
    const buffer = submission.fileId
      ? await readFile(submission.fileId)
      : undefined;
    const result = await buildAssessment({
      text: submission.originalText ?? undefined,
      buffer,
      mime: submission.fileMime ?? undefined,
      kind: submission.inputType as any,
      language: submission.language ?? "auto",
    });
    const lease = await JobModel.exists({
      _id: job._id,
      leaseToken: token,
      status: "processing",
    });
    if (!lease) return;
    const title =
      fieldValue(result.assessment, "businessName") ?? submission.title;
    await SubmissionModel.updateOne(
      { _id: submission._id },
      {
        $set: {
          assessment: result.assessment,
          embedding: result.embedding ?? [],
          embeddingModel: config.GEMINI_EMBEDDING_MODEL,
          title,
          status: result.assessment.reviewRequired ? "needs_review" : "ready",
          stage: "Assessment complete",
          error: null,
        },
      },
    );
    await JobModel.updateOne(
      { _id: job._id, leaseToken: token },
      { $set: { status: "done" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Processing failed.";
    const retry =
      error instanceof ProviderError && error.retryable && job.attempts < 3;
    const lease = await JobModel.exists({
      _id: job._id,
      leaseToken: token,
      status: "processing",
    }).catch(() => null);
    if (lease) {
      await JobModel.updateOne(
        { _id: job._id, leaseToken: token },
        {
          $set: {
            status: retry ? "queued" : "failed",
            error: message,
            runAt: new Date(Date.now() + 60000 * job.attempts),
          },
        },
      ).catch(() => {});
      await SubmissionModel.updateOne(
        { _id: job.submissionId },
        {
          $set: {
            status: retry ? "queued" : "failed",
            stage: retry ? "Waiting to retry" : "Needs attention",
            error: message,
          },
        },
      ).catch(() => {});
    }
  } finally {
    clearInterval(heartbeat);
  }
}

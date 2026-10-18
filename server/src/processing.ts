import { randomUUID, createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { config } from "./config.js";
import { reconcileQueuedSubmissions } from "./queue-recovery.js";
import {
  JobModel,
  SubmissionModel,
  CacheModel,
  readFile,
  databaseReady,
} from "./db.js";
import { assess, fieldValue } from "./domain/assessment.js";
import {
  readSource,
  extractFieldsWithProvider,
  translateQuestions,
  embed,
  ProviderError,
} from "./providers/gemini.js";
import { transcribe } from "./providers/audio.js";
import { applyClassifier } from "./providers/classifier.js";
import type { Assessment } from "../../shared/types.js";
import {
  generationGate,
  groqGate,
  cloudGate,
  generationAvailability,
} from "./providers/quota.js";

export interface ProcessingCheckpoint {
  fingerprint: string;
  audioSegments?: Awaited<ReturnType<typeof transcribe>>;
  source?: Awaited<ReturnType<typeof readSource>>;
  fields?: Awaited<ReturnType<typeof extractFieldsWithProvider>>["fields"];
  fieldsModel?: string;
}
export const quotaCacheKey = (
  provider: "gemini" | "groq" | "cloud" = "gemini",
) =>
  `${provider === "groq" ? "groq" : "generation"}-quota:${createHash("sha256")
    .update(
      provider === "cloud"
        ? `${config.CLOUD_AI_URL}:${config.CLOUD_AI_MODEL}:${config.CLOUD_AI_TOKEN}`
        : provider === "groq"
          ? `${config.GROQ_API_KEY}:${config.GROQ_MODEL}`
          : `${config.GEMINI_API_KEY}:${config.GEMINI_MODEL}`,
    )
    .digest("hex")}`;

export function retryPlan(error: unknown, attempts: number, now = Date.now()) {
  const provider = error instanceof ProviderError ? error : null;
  const rateLimit =
    !!provider?.code.startsWith("PROVIDER_") &&
    /QUOTA|RATE_LIMITED/.test(provider.code);
  const retry = !!provider?.retryable && (attempts < 3 || rateLimit);
  return {
    retry,
    attempts:
      rateLimit && provider?.retryable ? Math.max(0, attempts - 1) : attempts,
    runAt: new Date(
      now +
        Math.max(
          60000 * 2 ** Math.min(4, Math.max(0, attempts - 1)),
          provider?.retryAfterMs ?? 0,
        ),
    ),
  };
}
export async function buildAssessment(input: {
  text?: string;
  buffer?: Buffer;
  mime?: string;
  kind: "text" | "pdf" | "audio";
  language: string;
  version?: number;
  onStage?: (stage: string) => void | Promise<void>;
  checkpoint?: ProcessingCheckpoint;
  onCheckpoint?: (checkpoint: ProcessingCheckpoint) => void | Promise<void>;
}): Promise<{ assessment: Assessment; embedding: number[] | null }> {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        input.kind,
        input.language,
        input.mime,
        config.GEMINI_MODEL,
        config.GROQ_MODEL,
        config.CLOUD_AI_URL,
        config.CLOUD_AI_MODEL,
        config.AUDIO_PROVIDER,
        config.SARVAM_MODEL,
        config.GROQ_SPEECH_MODEL,
      ]),
    )
    .update(input.buffer ?? input.text ?? "")
    .digest("hex");
  const checkpoint: ProcessingCheckpoint =
    input.checkpoint?.fingerprint === fingerprint
      ? { ...input.checkpoint }
      : { fingerprint };
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
  let audioSegments = checkpoint.audioSegments;
  let speechFallback = false;
  if (
    !audioSegments &&
    input.kind === "audio" &&
    (config.CLOUD_AI_URL ||
      config.AUDIO_PROVIDER === "sarvam" ||
      config.AUDIO_PROVIDER === "cloud")
  ) {
    try {
      audioSegments = await transcribe(
        input.buffer!,
        input.language,
        input.onStage,
      );
    } catch (error) {
      if (
        !config.CLOUD_AI_URL &&
        config.GEMINI_API_KEY &&
        error instanceof ProviderError &&
        /^SPEECH_(UNAVAILABLE|CREDITS_UNAVAILABLE|RATE_LIMITED)$/.test(
          error.code,
        )
      ) {
        speechFallback = true;
        await input.onStage?.("Reading recording with backup speech service");
      } else throw error;
    }
  }
  if (audioSegments && !checkpoint.audioSegments) {
    checkpoint.audioSegments = audioSegments;
    await input.onCheckpoint?.(checkpoint);
  }
  await input.onStage?.("Reading and translating source evidence");
  const source =
    checkpoint.source ??
    (await readSource({
      ...input,
      buffer: audioSegments ? undefined : input.buffer,
      pageCount,
      audioSegments,
    }));
  if (speechFallback && !checkpoint.source)
    source.warnings.push(
      "The recording was read by the hosted document model because speech services were unavailable. Check every transcript against the original audio.",
    );
  if (!checkpoint.source) {
    checkpoint.source = source;
    await input.onCheckpoint?.(checkpoint);
  }
  await input.onStage?.("Extracting business facts");
  const extraction = checkpoint.fields
    ? {
        fields: checkpoint.fields,
        providerModel: checkpoint.fieldsModel ?? config.GEMINI_MODEL,
      }
    : await extractFieldsWithProvider(source.segments);
  const fields = extraction.fields;
  if (!checkpoint.fields) {
    checkpoint.fields = fields;
    checkpoint.fieldsModel = extraction.providerModel;
    await input.onCheckpoint?.(checkpoint);
  }
  await input.onStage?.("Validating evidence and assessment");
  const assessment = assess({
    fields,
    segments: source.segments,
    language: source.language,
    providerModel: [
      ...new Set([
        source.providerModel ?? config.GEMINI_MODEL,
        extraction.providerModel,
      ]),
    ].join(" + "),
    version: input.version,
    warnings: source.warnings,
  });
  if (
    extraction.providerModel.startsWith("groq/") &&
    !assessment.warnings.some((w) => w.includes("Groq hosted fallback"))
  )
    assessment.warnings.push(
      "Groq hosted fallback performed fact extraction. Source citations and evidence checks still apply.",
    );
  const speechModels = [
    ...new Set(
      audioSegments
        ?.map((s) => s.transcriptionModel)
        .filter((s): s is string => !!s) ?? [],
    ),
  ];
  if (speechModels.length)
    assessment.providerModel = [...speechModels, assessment.providerModel].join(
      " + ",
    );
  if (speechModels.some((model) => model.startsWith("groq/")))
    assessment.warnings.push(
      "Backup speech transcription was used. Compare the transcript with the original recording before relying on it.",
    );
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
  await input.onStage?.("Checking response relevance");
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
      await input.onStage?.("Finding related ideas");
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
const workerTasks = new Set<Promise<void>>();
function trackWorkerTask(promise: Promise<void>) {
  const task = promise
    .catch(() =>
      console.error(
        "Processing worker: task interrupted; durable jobs remain recoverable.",
      ),
    )
    .finally(() => workerTasks.delete(task));
  workerTasks.add(task);
}
export async function drainWorker() {
  while (workerTasks.size) await Promise.allSettled([...workerTasks]);
}
export function startWorker() {
  if (timer) return;
  timer = setInterval(() => {
    trackWorkerTask(tick());
  }, 1800);
  timer.unref();
  trackWorkerTask(tick());
}
export function stopWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
async function tick() {
  if (ticking || !timer || !databaseReady()) return;
  ticking = true;
  try {
    await reconcileQueuedSubmissions();
    const [geminiCooldown, groqCooldown] = config.CLOUD_AI_URL
      ? [null, null]
      : await Promise.all(
          (["gemini", "groq"] as const).map((provider) =>
            CacheModel.findOne({
              key: quotaCacheKey(provider),
              expiresAt: { $gt: new Date() },
            }).lean(),
          ),
        );
    const cloudCooldown = config.CLOUD_AI_URL
      ? await CacheModel.findOne({
          key: quotaCacheKey("cloud"),
          expiresAt: { $gt: new Date() },
        }).lean()
      : null;
    for (const [provider, entry] of [
      ["gemini", geminiCooldown],
      ["groq", groqCooldown],
      ["cloud", cloudCooldown],
    ] as const) {
      if (!entry?.value) continue;
      const until = new Date(entry.expiresAt!).getTime();
      const { message, code, retryable } = entry.value;
      (provider === "cloud"
        ? cloudGate
        : provider === "gemini"
          ? generationGate
          : groqGate
      ).defer(
        new ProviderError(
          message,
          retryable,
          code,
          until - Date.now(),
          false,
          provider,
        ),
        until,
      );
    }
    const availability = generationAvailability(
      config.CLOUD_AI_URL
        ? [
            {
              provider: "cloud",
              configured: true,
              until: cloudCooldown?.expiresAt?.getTime() ?? 0,
            },
          ]
        : [
            {
              provider: "gemini",
              configured: !!config.GEMINI_API_KEY,
              until: geminiCooldown?.expiresAt?.getTime() ?? 0,
            },
            {
              provider: "groq",
              configured: !!config.GROQ_API_KEY,
              until: groqCooldown?.expiresAt?.getTime() ?? 0,
            },
          ],
    );
    const cooldown = availability.blocked
      ? availability.provider === "cloud"
        ? cloudCooldown
        : availability.provider === "groq"
          ? groqCooldown
          : geminiCooldown
      : null;
    if (cooldown?.value) {
      const { message, code } = cooldown.value;
      await SubmissionModel.updateMany(
        { status: "queued", nextRetryAt: { $ne: cooldown.expiresAt } },
        {
          $set: {
            stage: "Waiting for AI quota",
            error: message,
            errorCode: code,
            errorProvider: availability.provider,
            nextRetryAt: cooldown.expiresAt,
          },
        },
      );
      return;
    }
    // A ready provider can resume jobs postponed by the other provider's quota.
    if (
      (availability.provider === "cloud" && config.CLOUD_AI_URL) ||
      (availability.provider === "groq" && config.GROQ_API_KEY) ||
      (availability.provider === "gemini" && config.GEMINI_API_KEY)
    ) {
      const waiting = await SubmissionModel.find({
        status: "queued",
        errorProvider: { $ne: availability.provider },
        errorCode: { $in: ["PROVIDER_DAILY_QUOTA", "PROVIDER_RATE_LIMITED"] },
      })
        .select("_id")
        .lean();
      if (waiting.length) {
        const ids = waiting.map((s) => s._id);
        await JobModel.updateMany(
          {
            submissionId: { $in: ids },
            status: "queued",
            errorProvider: { $ne: availability.provider },
          },
          { $set: { runAt: new Date() } },
        );
        await SubmissionModel.updateMany(
          { _id: { $in: ids }, status: "queued" },
          {
            $set: {
              stage: "Waiting for backup AI service",
              error: null,
              errorCode: null,
              errorProvider: null,
              nextRetryAt: null,
            },
          },
        );
      }
    }
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
          {
            _id: stale.submissionId,
            status: { $in: ["processing", "queued"] },
          },
          {
            $set: {
              status: "failed",
              stage: "Needs attention",
              error: "Processing was interrupted. Review the source and retry.",
            },
          },
        );
    }
    while (timer && running < config.PROCESSING_CONCURRENCY) {
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
      trackWorkerTask(
        processJob(job, token).finally(() => {
          running--;
        }),
      );
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
          errorCode: null,
          errorProvider: null,
          nextRetryAt: null,
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
      checkpoint: job.checkpoint,
      onCheckpoint: async (checkpoint) => {
        const saved = await JobModel.updateOne(
          { _id: job._id, leaseToken: token, status: "processing" },
          { $set: { checkpoint } },
        );
        if (!saved.matchedCount)
          throw new ProviderError(
            "Processing lease expired. The saved job will resume safely.",
            true,
          );
      },
      onStage: async (stage) => {
        await SubmissionModel.updateOne(
          { _id: submission._id, status: "processing" },
          { $set: { stage } },
        );
      },
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
          errorCode: null,
          errorProvider: null,
          nextRetryAt: null,
        },
      },
    );
    await JobModel.updateOne(
      { _id: job._id, leaseToken: token },
      { $set: { status: "done" }, $unset: { checkpoint: 1 } },
    );
  } catch (error) {
    const { retry, runAt, attempts } = retryPlan(error, job.attempts);
    const providerMessage =
      error instanceof Error ? error.message : "Processing failed.";
    const message =
      error instanceof ProviderError && error.retryable && !retry
        ? `${providerMessage.replace(/Processing will (?:retry automatically|resume after the provider's quota reset)\. /, "")} Automatic attempts have stopped after three failures. Check service availability and use Retry processing.`
        : providerMessage;
    const errorCode =
      error instanceof ProviderError ? error.code : "PROCESSING_FAILED";
    const errorProvider =
      error instanceof ProviderError ? error.provider : null;
    const lease = await JobModel.exists({
      _id: job._id,
      leaseToken: token,
      status: "processing",
    }).catch(() => null);
    if (lease) {
      if (
        error instanceof ProviderError &&
        error.retryAfterMs > 0 &&
        /QUOTA|RATE_LIMITED/.test(error.code)
      ) {
        await CacheModel.findOneAndUpdate(
          { key: quotaCacheKey(error.provider) },
          {
            $set: {
              value: { message, code: errorCode, retryable: error.retryable },
            },
            $max: { expiresAt: runAt },
          },
          { upsert: true },
        ).catch(() => {});
      }
      await JobModel.updateOne(
        { _id: job._id, leaseToken: token },
        {
          $set: {
            status: retry ? "queued" : "failed",
            error: message,
            errorCode,
            errorProvider,
            attempts,
            runAt,
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
            errorCode,
            errorProvider,
            nextRetryAt: retry ? runAt : null,
          },
        },
      ).catch(() => {});
    }
  } finally {
    clearInterval(heartbeat);
  }
}

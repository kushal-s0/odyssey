import { config } from "../config.js";
import { embed } from "./gemini.js";
import { FIELD_LABELS, type Assessment } from "../../../shared/types.js";
export async function applyClassifier(assessment: Assessment) {
  if (!config.MODEL_SERVICE_URL) return;
  assessment.classifier = { status: "unavailable", flags: [] };
  try {
    const url = new URL(config.MODEL_SERVICE_URL);
    if (url.protocol !== "https:" && config.NODE_ENV === "production")
      throw new Error("The model service must use HTTPS.");
    const metaResponse = await fetch(new URL("/health", url), {
      signal: AbortSignal.timeout(15000),
    });
    const meta: any = await metaResponse.json();
    if (
      !meta.ready ||
      meta.embeddingModel !== config.GEMINI_EMBEDDING_MODEL ||
      meta.dimension !== 768 ||
      meta.featureVersion !== "context-question-answer-v1"
    )
      throw new Error("Incompatible or untrained model service.");
    const context = assessment.fields
      .filter((f) => ["businessName", "products"].includes(f.key))
      .map((f) => f.value ?? "")
      .join(" ");
    const fields = assessment.fields
      .filter((f) => f.status === "supported" && f.value)
      .slice(0, 14);
    if (!fields.length) {
      assessment.classifier = {
        status: "available",
        flags: [],
        modelVersion: String(meta.modelVersion),
      };
      return;
    }
    const vectors = [];
    for (const field of fields)
      vectors.push(
        await embed(
          `Business: ${context}\nQuestion: ${FIELD_LABELS[field.key]}\nAnswer: ${field.value}`,
          "CLASSIFICATION",
        ),
      );
    const response = await fetch(new URL("/predict", url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.MODEL_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        vectors,
        embeddingModel: config.GEMINI_EMBEDDING_MODEL,
        featureVersion: "context-question-answer-v1",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("Classifier unavailable.");
    const result: any = await response.json();
    if (
      !Array.isArray(result.predictions) ||
      result.predictions.length !== fields.length
    )
      throw new Error("Invalid classifier output.");
    const flags = result.predictions.flatMap((p: any, index: number) =>
      typeof p.offTopicScore === "number" &&
      Number.isFinite(p.offTopicScore) &&
      p.offTopicScore >= 0.75
        ? [{ field: fields[index]!.key, score: p.offTopicScore }]
        : [],
    );
    assessment.classifier = {
      status: "available",
      flags,
      modelVersion: String(result.modelVersion),
    };
    if (flags.length) {
      assessment.reviewRequired = true;
      assessment.warnings.push(
        "The trained relevance model flagged responses for assessor review. Its scores are advisory and do not establish truth.",
      );
    }
  } catch {
    assessment.warnings.push(
      "The optional relevance classifier is unavailable or incompatible. Evidence validation and rubric assessment still ran.",
    );
  }
}

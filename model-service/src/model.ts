import { z } from "zod";
export const artifactSchema = z
  .object({
    format: z.literal("strive-relevance-v1"),
    modelVersion: z.string().min(1),
    featureVersion: z.literal("context-question-answer-v1"),
    embeddingModel: z.string(),
    dimension: z.number().int().min(1).max(3072),
    coefficients: z.array(z.number().finite()),
    intercept: z.number().finite(),
    classes: z.tuple([z.literal(0), z.literal(1)]),
    trainingDataHash: z.string(),
    trainedAt: z.string(),
    metrics: z.record(z.unknown()),
    advisoryOnly: z.literal(true),
  })
  .refine(
    (a) => a.coefficients.length === a.dimension,
    "Coefficient dimension mismatch.",
  );
export type ModelArtifact = z.infer<typeof artifactSchema>;
export function linearScore(vector: number[], artifact: ModelArtifact) {
  if (
    vector.length !== artifact.dimension ||
    vector.some((v) => !Number.isFinite(v))
  )
    throw new Error("Invalid feature vector.");
  const logit = vector.reduce(
    (sum, value, i) => sum + value * artifact.coefficients[i]!,
    artifact.intercept,
  );
  const offTopicScore =
    logit >= 0
      ? 1 / (1 + Math.exp(-logit))
      : Math.exp(logit) / (1 + Math.exp(logit));
  return {
    offTopicScore,
    flagForReview: offTopicScore >= 0.75,
    abstain: offTopicScore > 0.25 && offTopicScore < 0.75,
  };
}

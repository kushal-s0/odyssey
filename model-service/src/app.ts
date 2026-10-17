import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { linearScore, type ModelArtifact } from "./model.js";
export function createModelApp(artifact: ModelArtifact | null, token: string) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({ windowMs: 60000, limit: 60 }));
  app.get("/health", (_req, res) =>
    res.json({
      ready: !!artifact,
      modelVersion: artifact?.modelVersion ?? null,
      embeddingModel: artifact?.embeddingModel ?? null,
      dimension: artifact?.dimension ?? null,
      featureVersion: artifact?.featureVersion ?? null,
      metrics: artifact?.metrics ?? null,
      advisoryOnly: true,
    }),
  );
  app.post("/predict", (req, res) => {
    const actual = createHash("sha256")
      .update(req.headers.authorization ?? "")
      .digest();
    const expected = createHash("sha256").update(`Bearer ${token}`).digest();
    if (token.length < 32 || !timingSafeEqual(actual, expected)) {
      res.status(401).json({ error: "Invalid service token." });
      return;
    }
    if (!artifact) {
      res
        .status(503)
        .json({ error: "No cloud-trained model artefact has been loaded." });
      return;
    }
    const result = z
      .object({
        vectors: z
          .array(z.array(z.number().finite()).length(artifact.dimension))
          .min(1)
          .max(30),
        embeddingModel: z.literal(artifact.embeddingModel),
        featureVersion: z.literal(artifact.featureVersion),
      })
      .safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Features do not match the trained model configuration.",
      });
      return;
    }
    res.json({
      modelVersion: artifact.modelVersion,
      advisoryOnly: true,
      predictions: result.data.vectors.map((v) => linearScore(v, artifact)),
    });
  });
  return app;
}

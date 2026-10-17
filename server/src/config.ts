import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
dotenv.config({
  path: [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    fileURLToPath(new URL("../../.env", import.meta.url)),
    fileURLToPath(new URL("../../../../.env", import.meta.url)),
  ],
  quiet: true,
});
// Also works when launched from the repository root or from compiled output.
dotenv.config({ quiet: true });
const optional = z.string().default("");
export const config = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().default(4000),
    APP_URL: z.string().default("http://localhost:5173"),
    MONGODB_URI: optional,
    MONGODB_DB: z.string().default("strive_screening"),
    SESSION_SECRET: optional,
    ASSESSOR_EMAIL: z.string().default("assessor@example.com"),
    ASSESSOR_PASSWORD: optional,
    GEMINI_API_KEY: optional,
    GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
    GEMINI_THINKING_LEVEL: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
    GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
    SARVAM_API_KEY: optional,
    SARVAM_MODEL: z.string().default("saaras:v4"),
    AUDIO_PROVIDER: z.enum(["sarvam", "gemini"]).default("sarvam"),
    FFMPEG_PATH: optional,
    MODEL_SERVICE_URL: optional,
    MODEL_SERVICE_TOKEN: optional,
    OSM_USER_AGENT: z.string().default("StriveScreening/1.0 (hackathon demo)"),
    MAX_UPLOAD_MB: z.coerce.number().min(1).max(12).default(10),
    ENABLE_EXAMPLES: z
      .string()
      .default("true")
      .transform((v) => v === "true"),
    PROCESSING_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),
  })
  .parse(process.env);
export const health = () => ({
  database: false,
  gemini: !!config.GEMINI_API_KEY,
  sarvam: !!config.SARVAM_API_KEY,
  classifier: !!config.MODEL_SERVICE_URL,
  examples: config.ENABLE_EXAMPLES,
  maxUploadMb: config.MAX_UPLOAD_MB,
  audioProvider: config.AUDIO_PROVIDER,
});

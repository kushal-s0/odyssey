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
    CLOUD_AI_URL: optional,
    CLOUD_AI_TOKEN: optional,
    CLOUD_AI_MODEL: z.string().default("Qwen/Qwen3.5-9B"),
    CLOUD_AI_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(15000)
      .max(1800000)
      .default(150000),
    GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),
    GEMINI_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(512)
      .max(32768)
      .default(8192),
    GEMINI_THINKING_LEVEL: z
      .enum(["MINIMAL", "LOW", "MEDIUM", "HIGH"])
      .default("LOW"),
    GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
    GROQ_API_KEY: optional,
    GROQ_SPEECH_MODEL: z.string().default("whisper-large-v3-turbo"),
    GROQ_MODEL: z.string().default("openai/gpt-oss-20b"),
    GROQ_MIN_REQUEST_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(0)
      .max(60000)
      .default(3000),
    GROQ_MAX_COMPLETION_TOKENS: z.coerce
      .number()
      .int()
      .min(512)
      .max(16384)
      .default(4096),
    GEMINI_MIN_REQUEST_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(0)
      .max(60000)
      .default(12000),
    SARVAM_API_KEY: optional,
    SARVAM_MODEL: z.string().default("saaras:v4"),
    AUDIO_PROVIDER: z.enum(["sarvam", "gemini", "cloud"]).default("sarvam"),
    FFMPEG_PATH: optional,
    MODEL_SERVICE_URL: optional,
    MODEL_SERVICE_TOKEN: optional,
    GEOAPIFY_API_KEY: optional,
    OSM_USER_AGENT: z.string().default("StriveScreening/1.0 (hackathon demo)"),
    MAX_UPLOAD_MB: z.coerce.number().min(1).max(12).default(10),
    ENABLE_EXAMPLES: z
      .string()
      .default("true")
      .transform((v) => v === "true"),
    PROCESSING_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  })
  .parse(process.env);
export const health = () => ({
  database: false,
  gemini: !!config.GEMINI_API_KEY,
  groq: !!config.GROQ_API_KEY,
  cloud: !!config.CLOUD_AI_URL && !!config.CLOUD_AI_TOKEN,
  sarvam: !!config.SARVAM_API_KEY,
  classifier: !!config.MODEL_SERVICE_URL,
  places: !!config.GEOAPIFY_API_KEY,
  examples: config.ENABLE_EXAMPLES,
  maxUploadMb: config.MAX_UPLOAD_MB,
  audioProvider: config.CLOUD_AI_URL ? "cloud" : config.AUDIO_PROVIDER,
});

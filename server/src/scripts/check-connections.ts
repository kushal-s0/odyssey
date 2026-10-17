import mongoose from "mongoose";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "../config.js";
const results: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
};
const root = process.cwd().endsWith("server")
  ? resolve(process.cwd(), "..")
  : process.cwd();
async function check(name: string, fn: () => Promise<unknown>) {
  if (process.argv.includes("--atlas-only") && name !== "atlas") return;
  try {
    results[name] = { ok: true, ...((await fn()) as object) };
  } catch (error: any) {
    const message = String(error?.message ?? "");
    results[name] = {
      ok: false,
      errorType: error?.name ?? "Error",
      code: error?.code ?? null,
      ...(name === "atlas"
        ? {
            accessListAdvice: /IP|whitelist|allowlist/i.test(message),
            nodes: [...(error?.reason?.servers?.values?.() ?? [])].map(
              (server: any) => ({
                state: server.type,
                errorType: server.error?.name ?? null,
                code: server.error?.code ?? null,
                causeCode: server.error?.cause?.code ?? null,
                tlsFailure: /TLS|SSL|certificate/i.test(
                  String(server.error?.message ?? ""),
                ),
                timedOut: /timed out|timeout/i.test(
                  String(server.error?.message ?? ""),
                ),
              }),
            ),
          }
        : {}),
      reason: /authentication failed|bad auth/i.test(message)
        ? "Database authentication failed."
        : /querySrv|ENOTFOUND/i.test(message)
          ? "The Atlas cluster address could not be resolved."
          : /timed out|server selection|ECONNREFUSED/i.test(message)
            ? "Connection failed. Check network access and the Atlas IP allowlist."
            : (error?.safeMessage ??
              "Connection or configuration check failed. No secret values were logged."),
    };
  }
  console.log(JSON.stringify({ service: name, ...(results[name] as object) }));
}
await Promise.all([
  check("atlas", async () => {
    if (!config.MONGODB_URI || /[<>]/.test(config.MONGODB_URI))
      throw Object.assign(new Error(), {
        safeMessage:
          "Complete the Atlas URI and replace any remaining placeholders.",
      });
    await mongoose.connect(config.MONGODB_URI, {
      dbName: config.MONGODB_DB,
      serverSelectionTimeoutMS: 15000,
    });
    await mongoose.connection.db!.admin().ping();
    await mongoose.disconnect();
    return { connected: true };
  }),
  check("gemini", async () => {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": config.GEMINI_API_KEY },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw Object.assign(new Error(), {
        safeMessage: `Model listing returned HTTP ${response.status}. Check Gemini key access.`,
      });
    const json: any = await response.json();
    const available = json.models ?? [];
    const generation = available.some(
      (m: any) => m.name === `models/${config.GEMINI_MODEL}`,
    );
    const embedding = available.some(
      (m: any) => m.name === `models/${config.GEMINI_EMBEDDING_MODEL}`,
    );
    return {
      keyAccepted: true,
      generationModelAvailable: generation,
      embeddingModelAvailable: embedding,
      configuredGenerationModel: config.GEMINI_MODEL,
      configuredEmbeddingModel: config.GEMINI_EMBEDDING_MODEL,
      ...(!generation
        ? {
            availableGenerationModels: available
              .filter((m: any) =>
                m.supportedGenerationMethods?.includes("generateContent"),
              )
              .map((m: any) => m.name)
              .slice(0, 25),
          }
        : {}),
    };
  }),
  check("sarvam", async () => {
    // A generated one-second silent PCM waveform: no participant content or local model.
    const wave = Buffer.alloc(44 + 32000);
    wave.write("RIFF", 0);
    wave.writeUInt32LE(wave.length - 8, 4);
    wave.write("WAVE", 8);
    wave.write("fmt ", 12);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20);
    wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(16000, 24);
    wave.writeUInt32LE(32000, 28);
    wave.writeUInt16LE(2, 32);
    wave.writeUInt16LE(16, 34);
    wave.write("data", 36);
    wave.writeUInt32LE(32000, 40);
    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(wave)], { type: "audio/wav" }),
      "generated-silence.wav",
    );
    form.set("model", config.SARVAM_MODEL);
    form.set("mode", "transcribe");
    form.set("language_code", "hi-IN");
    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": config.SARVAM_API_KEY },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw Object.assign(new Error(), {
        safeMessage: `Speech test returned HTTP ${response.status}. Check Sarvam key, model availability, and credits.`,
      });
    const json: any = await response.json();
    return {
      keyAccepted: true,
      model: config.SARVAM_MODEL,
      sampleSeconds: 1,
      input: "generated silence",
      transcriptCharacters:
        typeof json.transcript === "string" ? json.transcript.length : 0,
      realSpeechNotTested: true,
    };
  }),
]);
await mongoose.disconnect().catch(() => {});
await mkdir(resolve(root, ".planning"), { recursive: true });
await writeFile(
  resolve(root, ".planning/live-connection-check.json"),
  JSON.stringify(results, null, 2),
);

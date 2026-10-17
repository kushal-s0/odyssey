import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { config } from "../config.js";
// The user explicitly approved uploading a 15-second dataset excerpt on 18 October 2026.
const root = process.cwd().endsWith("server")
  ? resolve(process.cwd(), "..")
  : process.cwd();
let report: Record<string, unknown>;
try {
  const manifest = JSON.parse(
    await readFile(resolve(root, "data/manifest.json"), "utf8"),
  );
  const sample = manifest.records.find(
    (r: any) => r.inputType === "audio" && r.language === "Hindi",
  );
  const ffmpeg =
    config.FFMPEG_PATH || createRequire(import.meta.url)("ffmpeg-static");
  const conversion = spawnSync(
    ffmpeg,
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      resolve(root, sample.path),
      "-t",
      "15",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "wav",
      "pipe:1",
    ],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 30000 },
  );
  if (conversion.status !== 0)
    throw new Error("Could not decode the approved excerpt.");
  const form = new FormData();
  form.set(
    "file",
    new Blob([new Uint8Array(conversion.stdout)], { type: "audio/wav" }),
    "approved-excerpt.wav",
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
    throw new Error(`The speech API returned HTTP ${response.status}.`);
  const json: any = await response.json();
  const transcript = typeof json.transcript === "string" ? json.transcript : "";
  await mkdir(resolve(root, ".planning"), { recursive: true });
  await writeFile(
    resolve(root, ".planning/approved-speech-transcript.txt"),
    transcript,
  );
  report = {
    ok: transcript.trim().length > 0,
    secondsUploaded: 15,
    language: json.language_code ?? "unknown",
    transcriptCharacters: transcript.length,
    qualityManuallyVerified: false,
  };
} catch (error: any) {
  report = {
    ok: false,
    reason:
      error.name === "TimeoutError"
        ? "Speech request timed out."
        : /^The speech API|^Could not decode/.test(error.message ?? "")
          ? error.message
          : "Speech test failed. No credentials were logged.",
  };
}
await mkdir(resolve(root, ".planning"), { recursive: true });
await writeFile(
  resolve(root, ".planning/approved-speech-check.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));

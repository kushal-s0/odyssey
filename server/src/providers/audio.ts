import {
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  unlink,
  rmdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { config } from "../config.js";
import { cloudPost } from "./cloud.js";
import { ProviderError } from "./gemini.js";
import type { SourceSegment } from "../../../shared/types.js";
const ffmpegStatic = createRequire(import.meta.url)("ffmpeg-static") as
  string | null;
async function convert(input: string, output: string) {
  const binary = config.FFMPEG_PATH || ffmpegStatic;
  if (!binary)
    throw new ProviderError(
      "FFmpeg is unavailable. Set FFMPEG_PATH to process recordings.",
    );
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      binary,
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "segment",
        "-segment_time",
        "25",
        "-reset_timestamps",
        "1",
        "-t",
        "1225",
        output,
      ],
      { windowsHide: true },
    );
    let errors = "";
    proc.stderr.on("data", (chunk) => {
      errors = (errors + chunk.toString()).slice(-1000);
    });
    const timer = setTimeout(() => {
      proc.kill();
      reject(new ProviderError("Audio conversion timed out."));
    }, 90000);
    proc.on("error", () => {
      clearTimeout(timer);
      reject(
        new ProviderError(
          "Audio conversion could not start. Check FFmpeg installation.",
        ),
      );
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(
            new ProviderError(
              "The recording could not be decoded. Please upload a supported audio file.",
            ),
          );
    });
  });
}
// Reads WAV chunks by their RIFF headers, rather than assuming a 44-byte header.
export function waveInfo(wave: Buffer) {
  if (
    wave.toString("ascii", 0, 4) !== "RIFF" ||
    wave.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new ProviderError("The recording could not be decoded.");
  let bytesPerSecond = 32000;
  let data: Buffer = Buffer.alloc(0);
  for (let offset = 12; offset + 8 <= wave.length;) {
    const size = wave.readUInt32LE(offset + 4),
      begin = offset + 8,
      end = begin + size;
    if (end > wave.length)
      throw new ProviderError("The recording is incomplete. Upload it again.");
    const name = wave.toString("ascii", offset, offset + 4);
    if (name === "fmt " && size >= 16)
      bytesPerSecond = wave.readUInt32LE(begin + 8);
    if (name === "data") data = wave.subarray(begin, end);
    offset = end + (size % 2);
  }
  let energy = 0;
  for (let i = 0; i + 1 < data.length; i += 2)
    energy += (data.readInt16LE(i) / 32768) ** 2;
  return {
    duration: bytesPerSecond ? data.length / bytesPerSecond : 0,
    silent: !data.length || Math.sqrt(energy / (data.length / 2)) < 0.0001,
  };
}
const codes: Record<string, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Marathi: "mr-IN",
  Telugu: "te-IN",
  Bengali: "bn-IN",
  Odia: "od-IN",
  "or-IN": "od-IN",
};
const speechLanguage = (value: string) => codes[value] ?? value;
function speechError(
  status: number,
  provider: string,
  retryAfter: string | null = null,
) {
  const retryable = status === 429 || status >= 500;
  return new ProviderError(
    status === 402
      ? `${provider} speech credits are unavailable. Add speech credits or use another recording service. Your original is saved.`
      : status === 401 || status === 403
        ? `${provider} speech access was denied. Check the speech API key. Your original is saved.`
        : status === 429
          ? `${provider} speech is busy. Your original is saved; processing will retry.`
          : `${provider} speech could not process the recording (HTTP ${status}). Your original is saved.`,
    retryable,
    status === 429
      ? "SPEECH_RATE_LIMITED"
      : status === 402
        ? "SPEECH_CREDITS_UNAVAILABLE"
        : "SPEECH_UNAVAILABLE",
    Math.max(0, Number(retryAfter) || 0) * 1000,
  );
}
export async function transcribeChunk(
  audio: Buffer,
  language: string,
  preferBackup = false,
) {
  const code = speechLanguage(language),
    useCloud = !!config.CLOUD_AI_URL || config.AUDIO_PROVIDER === "cloud";
  const form = () => {
    const value = new FormData();
    value.set(
      "file",
      new Blob([new Uint8Array(audio)], { type: "audio/wav" }),
      "recording.wav",
    );
    return value;
  };
  if (useCloud) {
    const body = form();
    body.set("language_code", code === "auto" ? "unknown" : code);
    const result = await cloudPost("v1/audio/transcriptions", body);
    return {
      text:
        typeof result.transcript === "string" ? result.transcript.trim() : "",
      model: "cloud/speech",
      backup: false,
    };
  }
  let primaryError: unknown;
  if (config.SARVAM_API_KEY && !preferBackup) {
    const body = form();
    body.set("model", config.SARVAM_MODEL);
    body.set("mode", "transcribe");
    body.set("language_code", code === "auto" ? "unknown" : code);
    try {
      const response = await fetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: { "api-subscription-key": config.SARVAM_API_KEY },
        body,
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok)
        throw speechError(
          response.status,
          "Sarvam",
          response.headers.get("retry-after"),
        );
      const result = await response.json();
      if (typeof result.transcript !== "string")
        throw new ProviderError(
          "Speech returned an unreadable answer. Try the recording again.",
          true,
          "SPEECH_UNAVAILABLE",
        );
      return {
        text: result.transcript.trim(),
        model: `sarvam/${config.SARVAM_MODEL}`,
        backup: false,
      };
    } catch (error) {
      primaryError = error;
    }
  }
  // Whisper does not support Odia reliably. Never silently label another language as Odia.
  if (!config.GROQ_API_KEY || code === "od-IN")
    throw (
      primaryError ??
      new ProviderError(
        "Speech is unavailable for this recording language. Check the speech service or type your answer.",
        false,
        "SPEECH_UNAVAILABLE",
      )
    );
  const body = form();
  body.set("model", config.GROQ_SPEECH_MODEL);
  body.set("response_format", "verbose_json");
  body.set("temperature", "0");
  if (code !== "auto" && code !== "unknown")
    body.set("language", code.split("-")[0]!);
  let response: Response;
  try {
    response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.GROQ_API_KEY}` },
        body,
        signal: AbortSignal.timeout(60000),
      },
    );
  } catch {
    throw new ProviderError(
      "The backup speech service did not respond. Your original is saved; processing will retry.",
      true,
      "SPEECH_UNAVAILABLE",
    );
  }
  if (!response.ok)
    throw speechError(
      response.status,
      "Backup",
      response.headers.get("retry-after"),
    );
  const result = await response.json();
  if (typeof result.text !== "string")
    throw new ProviderError(
      "The backup speech service returned an unreadable answer.",
      true,
      "SPEECH_UNAVAILABLE",
    );
  // Discard segments the provider itself identifies as silence or low-confidence output.
  const text = Array.isArray(result.segments)
    ? result.segments
        .filter(
          (s: any) =>
            typeof s.text === "string" &&
            !(
              s.no_speech_prob > 0.6 ||
              s.avg_logprob < -1.0 ||
              s.compression_ratio > 2.4
            ),
        )
        .map((s: any) => s.text.trim())
        .filter(Boolean)
        .join(" ")
    : result.text.trim();
  return { text, model: `groq/${config.GROQ_SPEECH_MODEL}`, backup: true };
}
export async function transcribe(
  buffer: Buffer,
  language: string,
  onStage?: (stage: string) => void | Promise<void>,
): Promise<SourceSegment[]> {
  if (
    !config.CLOUD_AI_URL &&
    config.AUDIO_PROVIDER !== "cloud" &&
    !config.SARVAM_API_KEY &&
    !config.GROQ_API_KEY
  )
    throw new ProviderError(
      "No speech service is configured. Ask the workspace owner to connect speech, or type your answer.",
      false,
      "SPEECH_UNAVAILABLE",
    );
  const directory = await mkdtemp(join(tmpdir(), "strive-audio-"));
  try {
    const original = join(directory, "input.media");
    await writeFile(original, buffer);
    await convert(original, join(directory, "chunk-%04d.wav"));
    const chunks = (await readdir(directory))
      .filter((f) => f.endsWith(".wav"))
      .sort();
    if (!chunks.length)
      throw new ProviderError(
        "No audio track was found in the uploaded recording.",
      );
    if (chunks.length > 48)
      throw new ProviderError(
        "Recordings longer than 20 minutes need to be split before upload.",
      );
    const segments: SourceSegment[] = [];
    let backup = false;
    for (let index = 0; index < chunks.length; index++) {
      await onStage?.(
        `Listening to recording: ${index + 1} / ${chunks.length}`,
      );
      const audio = await readFile(join(directory, chunks[index]!)),
        wave = waveInfo(audio);
      if (wave.silent) continue;
      const result = await transcribeChunk(audio, language, backup);
      backup = result.backup;
      if (result.text)
        segments.push({
          id: `a${index + 1}`,
          originalText: result.text,
          englishText: result.text,
          page: null,
          startSeconds: index * 25,
          endSeconds: index * 25 + wave.duration,
          kind: "audio",
          verified: false,
          transcriptionModel: result.model,
        });
    }
    if (!segments.length)
      throw new ProviderError(
        "No clear speech was found. Speak closer to the microphone or type your answer.",
        false,
        "SPEECH_EMPTY",
      );
    return segments;
  } finally {
    for (const name of await readdir(directory))
      await unlink(join(directory, name));
    await rmdir(directory);
  }
}

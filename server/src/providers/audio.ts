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
export async function transcribe(
  buffer: Buffer,
  language: string,
): Promise<SourceSegment[]> {
  const useCloud = !!config.CLOUD_AI_URL || config.AUDIO_PROVIDER === "cloud";
  if (!useCloud && !config.SARVAM_API_KEY)
    throw new ProviderError(
      "Set SARVAM_API_KEY or explicitly choose AUDIO_PROVIDER=gemini.",
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
    for (let index = 0; index < chunks.length; index++) {
      const audio = await readFile(join(directory, chunks[index]!));
      const form = new FormData();
      form.set(
        "file",
        new Blob([new Uint8Array(audio)], { type: "audio/wav" }),
        "recording.wav",
      );
      form.set("model", config.SARVAM_MODEL);
      form.set("mode", "transcribe");
      form.set("language_code", language === "auto" ? "unknown" : language);
      let result: any;
      if (useCloud) {
        result = await cloudPost("v1/audio/transcriptions", form);
      } else {
        const response = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: { "api-subscription-key": config.SARVAM_API_KEY },
          body: form,
          signal: AbortSignal.timeout(60000),
        });
        if (!response.ok)
          throw new ProviderError(
            `Speech API returned ${response.status}. Check access and quota.`,
            response.status === 429 || response.status >= 500,
          );
        result = await response.json();
      }
      const text =
        typeof result.transcript === "string" ? result.transcript.trim() : "";
      if (text)
        segments.push({
          id: `a${index + 1}`,
          originalText: text,
          englishText: text,
          page: null,
          startSeconds: index * 25,
          endSeconds: Math.min(
            (index + 1) * 25,
            index * 25 + Math.max(0, (audio.length - 44) / 32000),
          ),
          kind: "audio",
          verified: false,
        });
    }
    if (!segments.length)
      throw new ProviderError(
        "No speech could be transcribed. Check the recording and try again.",
      );
    return segments;
  } finally {
    for (const name of await readdir(directory))
      await unlink(join(directory, name));
    await rmdir(directory);
  }
}

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  transcribeChunk,
  transcribe,
  waveInfo,
} from "../src/providers/audio.js";
import { config } from "../src/config.js";
const originalFetch = globalThis.fetch,
  saved = {
    sarvam: config.SARVAM_API_KEY,
    groq: config.GROQ_API_KEY,
    cloud: config.CLOUD_AI_URL,
    provider: config.AUDIO_PROVIDER,
  };
afterEach(() => {
  globalThis.fetch = originalFetch;
  config.SARVAM_API_KEY = saved.sarvam;
  config.GROQ_API_KEY = saved.groq;
  config.CLOUD_AI_URL = saved.cloud;
  config.AUDIO_PROVIDER = saved.provider;
});
const setup = () => {
  config.CLOUD_AI_URL = "";
  config.AUDIO_PROVIDER = "sarvam";
  config.SARVAM_API_KEY = "test-speech";
  config.GROQ_API_KEY = "test-backup";
};
function wave() {
  const b = Buffer.alloc(44 + 3200);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(3200, 40);
  return b;
}
test("speech billing failure uses hosted backup, sends the right language and rejects silence metadata", async () => {
  setup();
  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (calls.length === 1) return new Response("{}", { status: 402 });
    const body = init!.body as FormData;
    assert.equal(body.get("language"), "hi");
    assert.equal(body.get("model"), "whisper-large-v3-turbo");
    assert.equal(body.get("response_format"), "verbose_json");
    return Response.json({
      text: "invented sentence and actual answer",
      segments: [
        { text: "invented sentence", no_speech_prob: 0.95 },
        {
          text: "actual answer",
          no_speech_prob: 0.01,
          avg_logprob: -0.2,
          compression_ratio: 1.1,
        },
      ],
    });
  };
  const result = await transcribeChunk(wave(), "hi-IN");
  assert.equal(result.text, "actual answer");
  assert.equal(result.backup, true);
  assert.match(result.model, /groq\/whisper/);
  assert.equal(calls.length, 2);
});
test("working primary speech keeps the exact transcript and avoids the backup", async () => {
  setup();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ transcript: "Original words: costs 15000." });
  };
  const result = await transcribeChunk(wave(), "auto");
  assert.equal(result.text, "Original words: costs 15000.");
  assert.equal(result.backup, false);
  assert.equal(calls, 1);
});
test("Odia is never sent to an unsupported backup, and credits failure stays actionable", async () => {
  setup();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}", { status: 402 });
  };
  await assert.rejects(
    () => transcribeChunk(wave(), "od-IN"),
    (e: any) =>
      e.code === "SPEECH_CREDITS_UNAVAILABLE" &&
      e.message.includes("original is saved"),
  );
  assert.equal(calls, 1);
});
test("backup-only mode skips a failed primary and reports busy safely", async () => {
  setup();
  globalThis.fetch = async (url) => {
    assert.match(String(url), /groq/);
    return new Response("private provider detail", {
      status: 429,
      headers: { "retry-after": "20" },
    });
  };
  await assert.rejects(
    () => transcribeChunk(wave(), "Marathi", true),
    (e: any) =>
      e.retryable &&
      e.retryAfterMs === 20000 &&
      !e.message.includes("private provider detail"),
  );
});
test("silent converted audio is rejected before any hosted call", async () => {
  setup();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error("No speech request allowed");
  };
  assert.deepEqual(waveInfo(wave()), { duration: 0.1, silent: true });
  await assert.rejects(() => transcribe(wave(), "en-IN"), /No clear speech/);
  assert.equal(calls, 0);
});

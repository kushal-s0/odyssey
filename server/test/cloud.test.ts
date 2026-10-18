import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import {
  cloudEndpoint,
  generateCloud,
  readCloudPdf,
} from "../src/providers/cloud.js";
import { readSource, embed } from "../src/providers/gemini.js";
import { cloudGate, ProviderError } from "../src/providers/quota.js";
import { transcribe } from "../src/providers/audio.js";
const original = {
  url: config.CLOUD_AI_URL,
  token: config.CLOUD_AI_TOKEN,
  fetch: globalThis.fetch,
};
beforeEach(() => {
  config.CLOUD_AI_URL = "https://private-model.example.test";
  config.CLOUD_AI_TOKEN = "test-private-service-token-1234567890";
});
afterEach(() => {
  config.CLOUD_AI_URL = original.url;
  config.CLOUD_AI_TOKEN = original.token;
  globalThis.fetch = original.fetch;
  cloudGate.reset();
});
const output = (value: unknown, finish = "stop") =>
  Response.json({
    choices: [
      { finish_reason: finish, message: { content: JSON.stringify(value) } },
    ],
  });
const segment = (text: string, page: number | null = null) => ({
  originalText: text,
  englishText: text,
  page,
  startSeconds: null,
  endSeconds: null,
});

test("private cloud transport requires a secret and protects it from redirects and public HTTP", () => {
  for (const address of [
    "http://public.example.test",
    "http://localhost.attacker.example.test",
    "https://user:password@example.test",
    "https://example.test?token=private",
  ]) {
    config.CLOUD_AI_URL = address;
    assert.throws(() => cloudEndpoint("v1/chat/completions"), /HTTPS/);
  }
  config.CLOUD_AI_URL = "http://127.0.0.1:8080";
  assert.equal(
    cloudEndpoint("v1/chat/completions").pathname,
    "/v1/chat/completions",
  );
  config.CLOUD_AI_TOKEN = "short";
  assert.throws(() => cloudEndpoint("v1/chat/completions"), /32 characters/);
});

test("cloud mode uses only the private host with strict schema and still withholds invented original text", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(String(url)).hostname, "private-model.example.test");
    assert.equal(options?.redirect, "error");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.chat_template_kwargs.enable_thinking, false);
    return output({
      language: "English",
      segments: [
        segment("Synthetic tailoring business."),
        segment("Invented profit 90000."),
      ],
    });
  };
  const result = await readSource({
    kind: "text",
    language: "en-IN",
    text: "Synthetic tailoring business.",
  });
  assert.equal(result.segments.length, 1);
  assert.ok(result.providerModel.startsWith("cloud/"));
  assert.ok(result.warnings.some((w) => w.includes("did not match")));
});

test("cloud PDF/OCR quotations must match the exact numbered page", async () => {
  const paths: string[] = [];
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    if (path.endsWith("documents/text"))
      return Response.json({
        pages: [
          { page: 1, text: "Synthetic tailoring business." },
          { page: 2, text: "Synthetic customers." },
        ],
        ocrPages: [2],
      });
    return output({
      language: "English",
      segments: [
        segment("Synthetic tailoring business.", 1),
        segment("Synthetic customers.", 1),
        segment("Fabricated total 9000.", 2),
      ],
    });
  };
  const result = await readSource({
    kind: "pdf",
    language: "en-IN",
    buffer: Buffer.from("%PDF synthetic test fixture"),
    mime: "application/pdf",
    pageCount: 2,
  });
  assert.deepEqual(paths, ["/v1/documents/text", "/v1/chat/completions"]);
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0]?.verified, false);
  assert.ok(result.warnings.some((w) => w.includes("cloud OCR")));
});

test("truncated or invalid cloud generations never publish a partial result or call another provider", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return output({ value: "partial" }, "length");
  };
  await assert.rejects(
    () => generateCloud("synthetic", "synthetic", {}),
    /incomplete/,
  );
  assert.equal(calls, 1);
  cloudGate.reset();
  globalThis.fetch = async () =>
    Response.json({
      choices: [{ finish_reason: "stop", message: { content: "invalid" } }],
    });
  await assert.rejects(
    () => generateCloud("synthetic", "synthetic", {}),
    /invalid structured/,
  );
});

test("cloud capacity errors defer requests and never reveal the upstream response", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("private source and token", {
      status: 503,
      headers: { "retry-after": "90" },
    });
  };
  await assert.rejects(
    () => generateCloud("synthetic", "synthetic", {}),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.retryAfterMs === 90000 &&
      !error.message.includes("private source"),
  );
  await assert.rejects(
    () => generateCloud("synthetic", "synthetic", {}),
    (error: unknown) => error instanceof ProviderError && !error.requestMade,
  );
  assert.equal(calls, 1);
});

test("private cloud mode disables external embeddings and rejects reordered PDF pages", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      pages: [{ page: 2, text: "Synthetic page" }],
      ocrPages: [],
    });
  };
  await assert.rejects(
    () => embed("Synthetic statement"),
    /disabled in private cloud mode/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    () => readCloudPdf(Buffer.from("%PDF synthetic")),
    /page ordering/,
  );
});

test("cloud audio preserves chunk timing and sends the WAV only to the private service", async () => {
  const audio = Buffer.alloc(44 + 32000);
  audio.write("RIFF");
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16000, 24);
  audio.writeUInt32LE(32000, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36);
  audio.writeUInt32LE(32000, 40);
  // Non-silent synthetic PCM exercises private transport; silence is rejected locally.
  for (let offset = 44; offset < audio.length; offset += 2)
    audio.writeInt16LE(
      Math.round(3000 * Math.sin((offset - 44) * 0.04)),
      offset,
    );
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(new URL(String(url)).pathname, "/v1/audio/transcriptions");
    const form = options?.body as FormData;
    assert.equal(form.get("language_code"), "od-IN");
    assert.ok(form.get("file") instanceof Blob);
    return Response.json({
      transcript: "Synthetic spoken answer.",
      model: "synthetic-test",
    });
  };
  const result = await transcribe(audio, "od-IN");
  assert.equal(calls, 1);
  assert.equal(result[0]?.startSeconds, 0);
  assert.ok(
    (result[0]?.endSeconds ?? 0) > 0.9 && (result[0]?.endSeconds ?? 0) < 1.1,
  );
  assert.equal(result[0]?.verified, false);
});

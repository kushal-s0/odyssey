import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { config } from "../src/config.js";
import {
  readSource,
  extractFieldsWithProvider,
  embed,
} from "../src/providers/gemini.js";
import { generateGroq } from "../src/providers/groq.js";
import {
  ProviderError,
  generationGate,
  groqGate,
  embeddingGate,
  groqResponseError,
  generationAvailability,
} from "../src/providers/quota.js";
import { extractPdfPages } from "../src/providers/pdf-text.js";
const original = {
  fetch: globalThis.fetch,
  gemini: config.GEMINI_API_KEY,
  groq: config.GROQ_API_KEY,
  geminiInterval: config.GEMINI_MIN_REQUEST_INTERVAL_MS,
  groqInterval: config.GROQ_MIN_REQUEST_INTERVAL_MS,
};
beforeEach(() => {
  config.GEMINI_API_KEY = "gemini-test-only";
  config.GROQ_API_KEY = "groq-test-only";
  config.GEMINI_MIN_REQUEST_INTERVAL_MS = 0;
  config.GROQ_MIN_REQUEST_INTERVAL_MS = 0;
});
afterEach(() => {
  globalThis.fetch = original.fetch;
  config.GEMINI_API_KEY = original.gemini;
  config.GROQ_API_KEY = original.groq;
  config.GEMINI_MIN_REQUEST_INTERVAL_MS = original.geminiInterval;
  config.GROQ_MIN_REQUEST_INTERVAL_MS = original.groqInterval;
  generationGate.reset();
  groqGate.reset();
  embeddingGate.reset();
});
const segment = (text: string, page: number | null = null) => ({
  originalText: text,
  englishText: text,
  page,
  startSeconds: null,
  endSeconds: null,
});
const groq = (value: unknown, finish = "stop") =>
  new Response(
    JSON.stringify({
      choices: [
        { finish_reason: finish, message: { content: JSON.stringify(value) } },
      ],
    }),
  );
const gemini = (value: unknown, finish = "STOP") =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason: finish,
          content: { parts: [{ text: JSON.stringify(value) }] },
        },
      ],
    }),
  );
const source = {
  language: "English",
  segments: [segment("Synthetic tailoring business.")],
};

test("Gemini 429 switches to Groq with strict JSON and server-only credentials", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).includes("googleapis"))
      return new Response("{}", { status: 429 });
    const body = JSON.parse(String(options?.body));
    assert.equal(
      (options?.headers as any).Authorization,
      "Bearer groq-test-only",
    );
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.model, config.GROQ_MODEL);
    return groq(source);
  };
  const result = await readSource({
    text: "Synthetic tailoring business.",
    kind: "text",
    language: "en-IN",
  });
  assert.equal(calls.length, 2);
  assert.equal(result.providerModel, `groq/${config.GROQ_MODEL}`);
  assert.ok(result.warnings.some((w) => w.includes("Groq hosted fallback")));
  await readSource({
    text: "Synthetic tailoring business.",
    kind: "text",
    language: "en-IN",
  });
  assert.equal(
    calls.filter((url) => url.includes("googleapis")).length,
    1,
    "known Gemini cooldown avoids repeated rejected requests",
  );
});
test("Gemini success avoids Groq and reports its actual model", async () => {
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.ok(String(url).includes("googleapis"));
    return gemini(source);
  };
  const result = await readSource({
    text: "Synthetic tailoring business.",
    kind: "text",
    language: "en-IN",
  });
  assert.equal(calls, 1);
  assert.equal(result.providerModel, config.GEMINI_MODEL);
});
test("the queue uses an available provider and waits only until the earliest provider recovers", () => {
  const gemini = { provider: "gemini" as const, configured: true, until: 200 };
  const groq = { provider: "groq" as const, configured: true, until: 300 };
  assert.deepEqual(generationAvailability([gemini, groq], 100), {
    provider: "gemini",
    blocked: true,
  });
  assert.deepEqual(generationAvailability([gemini, groq], 250), {
    provider: "gemini",
    blocked: false,
  });
  assert.deepEqual(
    generationAvailability(
      [
        { ...gemini, until: 500 },
        { ...groq, until: 0 },
      ],
      100,
    ),
    { provider: "groq", blocked: false },
  );
  assert.deepEqual(
    generationAvailability(
      [
        { ...gemini, configured: false },
        { ...groq, until: 0 },
      ],
      100,
    ),
    { provider: "groq", blocked: false },
  );
  assert.deepEqual(
    generationAvailability(
      [
        { ...gemini, until: 0 },
        { ...groq, until: 0 },
      ],
      100,
    ),
    { provider: "gemini", blocked: false },
  );
});
test("Gemini configuration errors and network outages can use Groq", async () => {
  for (const status of [401, 403, 404, 503, 0]) {
    generationGate.reset();
    globalThis.fetch = async (url) => {
      if (String(url).includes("groq.com")) return groq(source);
      if (!status) throw new Error("network test");
      return new Response("{}", { status });
    };
    const result = await readSource({
      text: "Synthetic tailoring business.",
      kind: "text",
      language: "en-IN",
    });
    assert.equal(result.providerModel, `groq/${config.GROQ_MODEL}`);
  }
});
test("blocked, truncated or invalid Gemini results do not bypass validation through a fallback", async () => {
  for (const response of [
    gemini(source, "SAFETY"),
    gemini(source, "MAX_TOKENS"),
    new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "invalid json" }] },
          },
        ],
      }),
    ),
  ]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return response;
    };
    await assert.rejects(() =>
      readSource({
        text: "Synthetic tailoring business.",
        kind: "text",
        language: "en-IN",
      }),
    );
    assert.equal(calls, 1);
  }
});
test("invented Groq original quotations are withheld", async () => {
  config.GEMINI_API_KEY = "";
  globalThis.fetch = async () =>
    groq({
      language: "English",
      segments: [segment("Guaranteed monthly profits of 90000.")],
    });
  await assert.rejects(
    () =>
      readSource({
        text: "Synthetic tailoring business.",
        kind: "text",
        language: "en-IN",
      }),
    /No reliable business content/,
  );
});
test("Groq malformed schemas and incomplete responses cannot publish facts", async () => {
  config.GEMINI_API_KEY = "";
  globalThis.fetch = async () =>
    groq({ fields: [{ key: "invented", value: "unsupported" }] });
  await assert.rejects(() => extractFieldsWithProvider([]));
  globalThis.fetch = async () => groq({ fields: [] }, "length");
  await assert.rejects(
    () => extractFieldsWithProvider([]),
    /blocked or incomplete/,
  );
});
test("Groq 429 respects daily reset headers and keeps its cooldown separate", async () => {
  const error = groqResponseError(
    new Response("{}", {
      status: 429,
      headers: {
        "retry-after": "2",
        "x-ratelimit-remaining-requests": "0",
        "x-ratelimit-reset-requests": "2h5m3.5s",
      },
    }),
  );
  assert.equal(error.provider, "groq");
  assert.equal(error.code, "PROVIDER_DAILY_QUOTA");
  assert.equal(error.retryAfterMs, 7505500);
  globalThis.fetch = async () =>
    new Response("{}", { status: 429, headers: { "retry-after": "120" } });
  await assert.rejects(
    () => generateGroq("test", "test", {}),
    (e: unknown) =>
      e instanceof ProviderError &&
      e.provider === "groq" &&
      e.retryAfterMs === 122000,
  );
  await generationGate.enter(0);
  await assert.rejects(
    () => groqGate.enter(0),
    (e: unknown) =>
      e instanceof ProviderError && e.provider === "groq" && !e.requestMade,
  );
});
test("audio fallback preserves the exact Sarvam original and its timestamps", async () => {
  config.GEMINI_API_KEY = "";
  const original = {
    ...segment("Synthetic tailoring business."),
    id: "speech-1",
    kind: "audio" as const,
    verified: false,
    startSeconds: 2,
    endSeconds: 5,
  };
  globalThis.fetch = async () => groq(source);
  const result = await readSource({
    kind: "audio",
    language: "en-IN",
    audioSegments: [original],
  });
  assert.equal(result.segments[0]?.startSeconds, 2);
  assert.equal(result.segments[0]?.endSeconds, 5);
  assert.equal(result.segments[0]?.verified, false);
});
test("raw audio is never silently sent to Groq's text endpoint", async () => {
  config.GEMINI_API_KEY = "";
  globalThis.fetch = async () => {
    assert.fail("must not send binary audio to chat");
  };
  await assert.rejects(
    () =>
      readSource({
        kind: "audio",
        language: "hi-IN",
        buffer: Buffer.from("audio"),
        mime: "audio/wav",
      }),
    (e: unknown) =>
      e instanceof ProviderError && e.code === "GROQ_UNSUPPORTED_INPUT",
  );
});
async function pdf(blank = false) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  document.addPage().drawText("Synthetic tailoring business on page one.", {
    x: 40,
    y: 700,
    font,
  });
  const second = document.addPage();
  if (!blank)
    second.drawText("Customers are synthetic commuters on page two.", {
      x: 40,
      y: 700,
      font,
    });
  return Buffer.from(await document.save());
}
test("PDF fallback extracts real pages and rejects fabricated or wrongly cited quotations", async () => {
  config.GEMINI_API_KEY = "";
  const buffer = await pdf();
  const pages = await extractPdfPages(buffer);
  assert.equal(pages.length, 2);
  assert.ok(pages[1]?.text.includes("page two"));
  globalThis.fetch = async (_url, options) => {
    const sent = JSON.parse(
      JSON.parse(String(options?.body)).messages[1].content,
    );
    assert.equal(sent.pages.length, 2);
    return groq({
      language: "English",
      segments: [
        segment("Synthetic tailoring business on page one.", 1),
        segment("Customers are synthetic commuters on page two.", 1),
        segment("Invented profits of 90000.", 2),
      ],
    });
  };
  const result = await readSource({
    kind: "pdf",
    language: "en-IN",
    buffer,
    mime: "application/pdf",
    pageCount: 2,
  });
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0]?.page, 1);
  assert.ok(
    result.warnings.some((w) => w.includes("did not match its cited page")),
  );
  assert.equal(result.segments[0]?.verified, false);
});
test("PDFs with unreadable pages fail explicitly instead of quietly dropping evidence", async () => {
  const buffer = await pdf(true);
  await assert.rejects(() => extractPdfPages(buffer), /selectable PDF text/);
});
test("embedding failures never use Groq vectors incompatible with the cloud-trained classifier", async () => {
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response("{}", { status: 429 });
  };
  await assert.rejects(() => embed("Synthetic context", "CLASSIFICATION"));
  assert.equal(urls.length, 1);
  assert.ok(urls[0]?.includes(":embedContent"));
});

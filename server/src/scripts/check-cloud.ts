import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "../config.js";
import {
  cloudEndpoint,
  cloudPost,
  generateCloud,
  readCloudPdf,
} from "../providers/cloud.js";
const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  input: "Synthetic UI-independent checks only; no participant records",
};
try {
  const response = await fetch(cloudEndpoint("health/ready"), {
    headers: { Authorization: `Bearer ${config.CLOUD_AI_TOKEN}` },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const ready = response.ok ? (await response.json()).ready : false;
  if (!ready) throw new Error("CLOUD_NOT_READY");
  report.ready = true;
  const generated = await generateCloud(
    "Return ok=true for this synthetic access check.",
    "Return only the requested JSON.",
    {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    },
  );
  report.structuredOutput = generated.value?.ok === true;
  const pdf = await PDFDocument.create();
  pdf
    .addPage()
    .drawText("SYNTHETIC cloud check. Products: tailoring services.", {
      x: 40,
      y: 700,
      size: 12,
    });
  const source = await readCloudPdf(Buffer.from(await pdf.save()));
  report.pdf =
    source.pages.length === 1 && source.pages[0]?.text.includes("tailoring");
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
  const form = new FormData();
  form.set(
    "file",
    new Blob([audio], { type: "audio/wav" }),
    "generated-silence.wav",
  );
  form.set("language_code", "en-IN");
  const speech = await cloudPost("v1/audio/transcriptions", form);
  report.speechAccess =
    typeof speech.transcript === "string" && speech.transcript.length === 0;
  report.realSpeechNotTested = true;
  report.ok = report.structuredOutput && report.pdf && report.speechAccess;
} catch {
  report.ok = false;
  report.reason =
    "Cloud is not configured/ready or a synthetic contract check failed. No provider body or secret was logged.";
}
const root = process.cwd().endsWith("server")
  ? resolve(process.cwd(), "..")
  : process.cwd();
await mkdir(resolve(root, ".planning"), { recursive: true });
await writeFile(
  resolve(root, ".planning/cloud-check.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
if (!report.ok) process.exitCode = 1;

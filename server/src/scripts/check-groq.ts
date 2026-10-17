import { mkdir, writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { generateGroq } from "../providers/groq.js";
import { ProviderError } from "../providers/quota.js";
const started = Date.now();
let report;
try {
  const result = await generateGroq(
    "This is a synthetic connectivity test. Return the status ok.",
    "Return a JSON object with status equal to ok. Do not add other content.",
    {
      type: "object",
      properties: { status: { type: "string", enum: ["ok"] } },
      required: ["status"],
      additionalProperties: false,
    },
  );
  if ((result.value as any)?.status !== "ok")
    throw new Error("Unexpected synthetic test result.");
  report = {
    ok: true,
    model: result.model,
    input: "synthetic connectivity test",
    strictJsonOutput: true,
    elapsedMs: Date.now() - started,
  };
} catch (error) {
  report = {
    ok: false,
    model: config.GROQ_MODEL,
    error:
      error instanceof ProviderError
        ? error.message
        : "Synthetic response validation failed.",
    code: error instanceof ProviderError ? error.code : "VALIDATION_FAILED",
  };
  process.exitCode = 1;
}
await mkdir(".planning", { recursive: true });
await writeFile(
  ".planning/groq-connection-check.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAssessment } from "../processing.js";
// Deliberately synthetic content. Never reads or uploads participant material.
const text =
  "Business idea: Sample Tea Stall. Products: tea and biscuits. Target customers: commuters at a bus stop. Customer problem: commuters need a quick breakfast. Business location: Pune, Maharashtra. Materials: tea leaves, milk, sugar, stove and cups. Suppliers: a nearby grocery wholesaler. Investment required: Rs. 30,000. Own investment: Rs. 18,000. Loan needed: Rs. 12,000. Price: Rs. 10 per cup. Projected monthly sales: Rs. 30,000. Market research: no survey done yet. Competition: two tea stalls near the bus stop. Differentiation: reusable cups and quick service. Experience: one year working at a cafe.";
let report: Record<string, unknown>;
const started = Date.now();
try {
  const { assessment, embedding } = await buildAssessment({
    text,
    kind: "text",
    language: "en-IN",
    onStage: (stage) =>
      console.log(
        JSON.stringify({
          stage,
          elapsedSeconds: Math.round((Date.now() - started) / 1000),
        }),
      ),
  });
  report = {
    ok: true,
    input: "synthetic English idea",
    sourceSegments: assessment.segments.length,
    supportedFields: assessment.fields.filter((f) => f.status === "supported")
      .length,
    score: assessment.score,
    completeness: assessment.completeness,
    dimensions: assessment.dimensions.length,
    embeddingDimensions: embedding?.length ?? 0,
    warnings: assessment.warnings,
  };
} catch (error: any) {
  report = {
    ok: false,
    input: "synthetic English idea",
    errorType: error?.name ?? "Error",
    reason:
      error?.name === "ProviderError"
        ? error.message
        : "Structured pipeline validation failed. No credentials were logged.",
  };
}
const root = process.cwd().endsWith("server")
  ? resolve(process.cwd(), "..")
  : process.cwd();
await mkdir(resolve(root, ".planning"), { recursive: true });
await writeFile(
  resolve(root, ".planning/live-pipeline-check.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));

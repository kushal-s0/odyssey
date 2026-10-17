import { embed } from "../providers/gemini.js";
try {
  const vector = await embed("An artificial tea stall business example.");
  console.log(
    JSON.stringify({
      ok: true,
      dimension: vector.length,
      norm: Math.sqrt(vector.reduce((n, v) => n + v * v, 0)),
    }),
  );
} catch (error: any) {
  console.log(
    JSON.stringify({
      ok: false,
      errorType: error.name,
      reason:
        error.name === "ProviderError"
          ? error.message
          : "Embedding check failed.",
    }),
  );
}

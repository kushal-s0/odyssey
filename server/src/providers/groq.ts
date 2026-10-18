import { config } from "../config.js";
import { ProviderError, groqGate, checkResponse } from "./quota.js";

export async function generateGroq(
  text: string,
  instruction: string,
  schema: unknown,
) {
  if (!config.GROQ_API_KEY)
    throw new ProviderError(
      "Configure GROQ_API_KEY to enable the hosted fallback.",
      false,
      "PROVIDER_CONFIGURATION",
      0,
      false,
      "groq",
    );
  let tokenBudget = config.GROQ_MAX_COMPLETION_TOKENS;
  // Retry a fresh strict generation once. Never salvage failed_generation or
  // weaken the schema to accept partial facts.
  for (let attempt = 0; attempt < 2; attempt++) {
    await groqGate.enter(config.GROQ_MIN_REQUEST_INTERVAL_MS);
    try {
      let response: Response;
      try {
        response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: config.GROQ_MODEL,
              messages: [
                { role: "system", content: instruction },
                { role: "user", content: text },
              ],
              temperature: 0,
              max_completion_tokens: tokenBudget,
              ...(/^openai\/gpt-oss-(20b|120b)$/.test(config.GROQ_MODEL)
                ? { reasoning_effort: "low" }
                : {}),
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "business_evidence",
                  strict: true,
                  schema,
                },
              },
            }),
            signal: AbortSignal.timeout(150000),
          },
        );
      } catch (error) {
        throw new ProviderError(
          error instanceof Error && error.name === "TimeoutError"
            ? "Groq timed out. Processing can be retried."
            : "Groq could not be reached. Check network access and retry.",
          true,
          "PROVIDER_TEMPORARILY_UNAVAILABLE",
          0,
          true,
          "groq",
        );
      }
      await checkResponse(response, groqGate, "groq");
      let json: any;
      try {
        json = await response.json();
      } catch {
        throw new ProviderError(
          "Groq returned an unreadable structured response. No assessment was published.",
          true,
          "PROVIDER_STRUCTURED_OUTPUT",
          3000,
          true,
          "groq",
        );
      }
      const candidate = json.choices?.[0];
      if (candidate?.message?.refusal)
        throw new ProviderError(
          "Groq output was blocked or incomplete. No assessment was published.",
          false,
          "SOURCE_PROCESSING_FAILED",
          0,
          true,
          "groq",
        );
      if (candidate?.finish_reason === "length")
        throw new ProviderError(
          "Groq output was blocked or incomplete because its output budget was reached. Submit shorter sections if retrying does not help. No assessment was published.",
          false,
          "PROVIDER_OUTPUT_LIMIT",
          0,
          true,
          "groq",
        );
      if (candidate?.finish_reason !== "stop")
        throw new ProviderError(
          "Groq output was blocked or incomplete. No assessment was published.",
          false,
          "SOURCE_PROCESSING_FAILED",
          0,
          true,
          "groq",
        );
      try {
        return {
          value: JSON.parse(candidate.message.content),
          model: `groq/${config.GROQ_MODEL}`,
        };
      } catch {
        throw new ProviderError(
          "Groq returned invalid structured data. No assessment was published.",
          true,
          "PROVIDER_STRUCTURED_OUTPUT",
          3000,
          true,
          "groq",
        );
      }
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof ProviderError &&
        ["PROVIDER_STRUCTURED_OUTPUT", "PROVIDER_OUTPUT_LIMIT"].includes(
          error.code,
        )
      ) {
        tokenBudget = Math.min(16384, tokenBudget * 2);
        continue;
      }
      throw error;
    }
  }
  throw new ProviderError(
    "Groq structured processing could not finish. Your original is saved.",
    false,
    "PROVIDER_STRUCTURED_OUTPUT",
    0,
    true,
    "groq",
  );
}

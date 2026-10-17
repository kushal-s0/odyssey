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
  await groqGate.enter(config.GROQ_MIN_REQUEST_INTERVAL_MS);
  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
        max_completion_tokens: config.GROQ_MAX_COMPLETION_TOKENS,
        response_format: {
          type: "json_schema",
          json_schema: { name: "business_evidence", strict: true, schema },
        },
      }),
      signal: AbortSignal.timeout(150000),
    });
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
  const json: any = await response.json();
  const candidate = json.choices?.[0];
  if (candidate?.finish_reason !== "stop" || candidate.message?.refusal)
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
      false,
      "SOURCE_PROCESSING_FAILED",
      0,
      true,
      "groq",
    );
  }
}

import { z } from "zod";
import { config } from "../config.js";
import { cloudGate, ProviderError } from "./quota.js";

export function cloudEndpoint(path: string) {
  let base: URL;
  try {
    base = new URL(
      config.CLOUD_AI_URL.endsWith("/")
        ? config.CLOUD_AI_URL
        : config.CLOUD_AI_URL + "/",
    );
  } catch {
    throw new ProviderError(
      "Configure the private cloud model address.",
      false,
      "PROVIDER_CONFIGURATION",
      0,
      false,
      "cloud",
    );
  }
  const privateHost =
    base.hostname === "localhost" ||
    base.hostname === "127.0.0.1" ||
    /^(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/.test(
      base.hostname,
    );
  if (
    (base.protocol !== "https:" &&
      !(base.protocol === "http:" && privateHost)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    config.CLOUD_AI_TOKEN.length < 32
  )
    throw new ProviderError(
      "Use HTTPS (or a private tunnel) and a cloud model token of at least 32 characters.",
      false,
      "PROVIDER_CONFIGURATION",
      0,
      false,
      "cloud",
    );
  return new URL(path.replace(/^\//, ""), base);
}
export async function cloudPost(path: string, body: unknown) {
  const url = cloudEndpoint(path);
  await cloudGate.enter(1000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${config.CLOUD_AI_TOKEN}`,
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: body instanceof FormData ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(150000),
    });
  } catch {
    throw new ProviderError(
      "Your cloud model could not be reached. The saved job can retry.",
      true,
      "PROVIDER_TEMPORARILY_UNAVAILABLE",
      0,
      true,
      "cloud",
    );
  }
  if (!response.ok) {
    const limited = response.status === 429 || response.status === 503;
    const seconds = Number(response.headers.get("retry-after"));
    const wait = limited
      ? Math.max(60000, Number.isFinite(seconds) ? seconds * 1000 : 0)
      : 0;
    const error = new ProviderError(
      limited
        ? "Your cloud model is busy. The saved job will resume automatically."
        : response.status === 401 || response.status === 403
          ? "Your cloud model rejected access. Check its private service token."
          : response.status === 422
            ? "The cloud model could not read this input. Check its supported format and language."
            : "Your cloud model rejected the request. Check its configuration and context allowance.",
      limited || response.status >= 500,
      limited
        ? "PROVIDER_RATE_LIMITED"
        : response.status >= 500
          ? "PROVIDER_TEMPORARILY_UNAVAILABLE"
          : "PROVIDER_CONFIGURATION",
      wait,
      true,
      "cloud",
    );
    if (limited) cloudGate.defer(error);
    throw error;
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderError(
      "The cloud model returned unreadable data. No assessment was published.",
      false,
      "PROVIDER_STRUCTURED_OUTPUT",
      0,
      true,
      "cloud",
    );
  }
}
export async function generateCloud(
  text: string,
  instruction: string,
  schema: unknown,
) {
  const result = await cloudPost("v1/chat/completions", {
    model: config.CLOUD_AI_MODEL,
    messages: [
      { role: "system", content: instruction },
      { role: "user", content: text },
    ],
    temperature: 0,
    max_tokens: 8192,
    chat_template_kwargs: { enable_thinking: false },
    response_format: {
      type: "json_schema",
      json_schema: { name: "business_evidence", strict: true, schema },
    },
  });
  const choice = result.choices?.[0];
  if (choice?.finish_reason !== "stop" || choice?.message?.refusal)
    throw new ProviderError(
      "The cloud model output was blocked or incomplete. No assessment was published.",
      false,
      "SOURCE_PROCESSING_FAILED",
      0,
      true,
      "cloud",
    );
  try {
    return {
      value: JSON.parse(choice.message.content),
      model: `cloud/${config.CLOUD_AI_MODEL}`,
    };
  } catch {
    throw new ProviderError(
      "The cloud model returned invalid structured output. No assessment was published.",
      false,
      "PROVIDER_STRUCTURED_OUTPUT",
      0,
      true,
      "cloud",
    );
  }
}
export async function readCloudPdf(buffer: Buffer) {
  const data = await cloudPost("v1/documents/text", {
    pdfBase64: buffer.toString("base64"),
  });
  const parsed = z
    .object({
      pages: z
        .array(
          z.object({
            page: z.number().int().min(1).max(25),
            text: z.string().min(1).max(100000),
          }),
        )
        .min(1)
        .max(25),
      ocrPages: z.array(z.number().int()).default([]),
    })
    .parse(data);
  if (
    parsed.pages.some((page, index) => page.page !== index + 1) ||
    parsed.pages.reduce((n, p) => n + p.text.length, 0) > 100000
  )
    throw new ProviderError(
      "The cloud PDF output exceeded its bounds or lost page ordering.",
      false,
      "SOURCE_PROCESSING_FAILED",
      0,
      true,
      "cloud",
    );
  return parsed;
}

import { config } from "../config.js";

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable = false,
    public code = "SOURCE_PROCESSING_FAILED",
    public retryAfterMs = 0,
    public requestMade = true,
    public provider: "gemini" | "groq" = "gemini",
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// Return safe, actionable errors. Never expose Google's response body or project IDs.
export async function providerResponseError(
  response: Response,
): Promise<ProviderError> {
  if (response.status !== 429)
    return new ProviderError(
      `Hosted AI service returned ${response.status}. Check model access and API configuration.`,
      response.status >= 500,
      response.status >= 500
        ? "PROVIDER_TEMPORARILY_UNAVAILABLE"
        : "PROVIDER_CONFIGURATION",
    );
  const body = await response.json().catch(() => ({}));
  const details = Array.isArray(body?.error?.details) ? body.error.details : [];
  const violations = details.flatMap((detail: any) =>
    Array.isArray(detail?.violations) ? detail.violations : [],
  );
  const daily = violations.some((v: any) =>
    /perday|per_day/i.test(`${v?.quotaId} ${v?.quotaMetric}`),
  );
  const unavailable = violations.some(
    (v: any) => v?.quotaValue !== undefined && Number(v.quotaValue) === 0,
  );
  const retryHeader = response.headers.get("retry-after");
  let delay = retryHeader
    ? /^\d+(\.\d+)?$/.test(retryHeader)
      ? Number(retryHeader) * 1000
      : Date.parse(retryHeader) - Date.now()
    : 0;
  for (const detail of details) {
    const seconds = /^(\d+(?:\.\d+)?)s$/.exec(String(detail?.retryDelay ?? ""));
    if (seconds)
      delay = Math.max(
        Number.isFinite(delay) ? delay : 0,
        Number(seconds[1]) * 1000,
      );
  }
  // Without a daily reset time, require an explicit retry after checking the quota.
  if (unavailable || (daily && !(delay > 0)))
    return new ProviderError(
      unavailable
        ? "This AI model has no quota available for the configured Google project. Ask the workspace administrator to check its model allowance in Google AI Studio. Your original submission is saved."
        : "The daily AI quota is exhausted. Ask the workspace administrator to check the reset time in Google AI Studio, then retry. Your original submission is saved.",
      false,
      unavailable ? "PROVIDER_QUOTA_UNAVAILABLE" : "PROVIDER_DAILY_QUOTA",
    );
  return new ProviderError(
    daily
      ? "The daily AI quota is exhausted. Processing will resume after the provider's quota reset. Your original submission is saved."
      : "The AI service is temporarily rate limited. Processing will retry automatically. Your original submission is saved.",
    true,
    daily ? "PROVIDER_DAILY_QUOTA" : "PROVIDER_RATE_LIMITED",
    Math.max(60000, Number.isFinite(delay) ? delay : 0) + 2000,
  );
}

// Separate model lanes: an embedding limit must not block document extraction.
export class RequestGate {
  private nextStart = 0;
  private cooldown: { until: number; error: ProviderError } | null = null;
  defer(error: ProviderError, until = Date.now() + error.retryAfterMs) {
    if (until > (this.cooldown?.until ?? 0)) this.cooldown = { until, error };
  }
  reset() {
    this.nextStart = 0;
    this.cooldown = null;
  }
  private check() {
    if (this.cooldown && this.cooldown.until > Date.now()) {
      const { error, until } = this.cooldown;
      throw new ProviderError(
        error.message,
        error.retryable,
        error.code,
        until - Date.now(),
        false,
        error.provider,
      );
    }
  }
  async enter(interval: number) {
    this.check();
    const start = Math.max(Date.now(), this.nextStart);
    this.nextStart = start + interval;
    if (start > Date.now())
      await new Promise((resolve) => setTimeout(resolve, start - Date.now()));
    this.check();
  }
}
export const generationGate = new RequestGate();
export const embeddingGate = new RequestGate();
export const groqGate = new RequestGate();
export function generationAvailability(
  providers: {
    provider: "gemini" | "groq";
    configured: boolean;
    until: number;
  }[],
  now = Date.now(),
) {
  const configured = providers.filter((p) => p.configured);
  const ready = configured.find((p) => p.until <= now);
  if (ready) return { provider: ready.provider, blocked: false };
  const earliest = configured.sort((a, b) => a.until - b.until)[0];
  return { provider: earliest?.provider ?? "gemini", blocked: !!earliest };
}
export function durationMs(value: string | null) {
  if (!value) return 0;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 1000;
  let delay = 0;
  for (const match of value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g))
    delay +=
      Number(match[1]) *
      ({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]!] ?? 0);
  return delay || Math.max(0, Date.parse(value) - Date.now()) || 0;
}
export function groqResponseError(response: Response) {
  const limited = response.status === 429;
  const daily =
    limited && response.headers.get("x-ratelimit-remaining-requests") === "0";
  const delay = limited
    ? Math.max(
        60000,
        durationMs(response.headers.get("retry-after")),
        daily
          ? durationMs(response.headers.get("x-ratelimit-reset-requests"))
          : durationMs(response.headers.get("x-ratelimit-reset-tokens")),
      ) + 2000
    : 0;
  return new ProviderError(
    limited
      ? "Groq is rate limited. Processing will retry automatically after its reported wait. Your original submission is saved."
      : response.status === 401 || response.status === 403
        ? "Groq rejected API access. Check GROQ_API_KEY and model permissions on the server."
        : response.status === 413
          ? "This document exceeds the configured Groq model's request allowance. Submit a shorter document. Your original is saved."
          : `Groq returned ${response.status}. Check model configuration and service availability.`,
    limited || response.status >= 500,
    limited
      ? daily
        ? "PROVIDER_DAILY_QUOTA"
        : "PROVIDER_RATE_LIMITED"
      : response.status >= 500
        ? "PROVIDER_TEMPORARILY_UNAVAILABLE"
        : "PROVIDER_CONFIGURATION",
    delay,
    true,
    "groq",
  );
}
export async function checkResponse(
  response: Response,
  gate: RequestGate,
  provider: "gemini" | "groq" = "gemini",
) {
  if (response.ok) return;
  const error =
    provider === "groq"
      ? groqResponseError(response)
      : await providerResponseError(response);
  if (response.status === 429)
    gate.defer(error, Date.now() + (error.retryAfterMs || 60000));
  throw error;
}
export const generationInterval = () => config.GEMINI_MIN_REQUEST_INTERVAL_MS;

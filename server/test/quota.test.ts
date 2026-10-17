import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ProviderError,
  RequestGate,
  providerResponseError,
} from "../src/providers/quota.js";
import { retryPlan } from "../src/processing.js";

const quotaResponse = (
  id: string,
  value = "20",
  delay?: string,
  header?: string,
) =>
  new Response(
    JSON.stringify({
      error: {
        message: "private-project-information-must-not-leak",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [{ quotaId: id, quotaValue: value }],
          },
          ...(delay
            ? [
                {
                  "@type": "type.googleapis.com/google.rpc.RetryInfo",
                  retryDelay: delay,
                },
              ]
            : []),
        ],
      },
    }),
    { status: 429, headers: header ? { "Retry-After": header } : {} },
  );

test("daily exhaustion respects the provider reset time instead of retrying after one minute", async () => {
  const error = await providerResponseError(
    quotaResponse(
      "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
      "20",
      "12072s",
    ),
  );
  assert.equal(error.code, "PROVIDER_DAILY_QUOTA");
  assert.equal(error.retryable, true);
  assert.equal(error.retryAfterMs, 12074000);
  assert.equal(retryPlan(error, 1, 1000).runAt.getTime(), 12075000);
  assert.ok(!error.message.includes("private-project"));
});
test("zero model quota and unknown daily resets require an explicit configuration check", async () => {
  const zero = await providerResponseError(
    quotaResponse("GenerateRequestsPerMinute", "0", "10s"),
  );
  assert.equal(zero.retryable, false);
  assert.equal(zero.code, "PROVIDER_QUOTA_UNAVAILABLE");
  const daily = await providerResponseError(
    quotaResponse("GenerateRequestsPerDay", "20"),
  );
  assert.equal(daily.retryable, false);
  assert.equal(daily.code, "PROVIDER_DAILY_QUOTA");
});
test("minute limits respect the longest Retry-After header or RetryInfo delay", async () => {
  const error = await providerResponseError(
    quotaResponse("GenerateRequestsPerMinute", "5", "12.5s", "180"),
  );
  assert.equal(error.code, "PROVIDER_RATE_LIMITED");
  assert.equal(error.retryAfterMs, 182000);
  const date = new Date(Date.now() + 300000).toUTCString();
  const dated = await providerResponseError(
    quotaResponse("GenerateRequestsPerMinute", "5", undefined, date),
  );
  assert.ok(dated.retryAfterMs >= 300000 && dated.retryAfterMs <= 302000);
});
test("malformed quota bodies still get a safe bounded retry", async () => {
  const error = await providerResponseError(
    new Response("not json", { status: 429 }),
  );
  assert.equal(error.retryAfterMs, 62000);
  assert.equal(error.retryable, true);
});
test("shared cooldown avoids requests and does not consume a job attempt", async () => {
  const gate = new RequestGate();
  gate.defer(
    new ProviderError("Wait for quota", true, "PROVIDER_DAILY_QUOTA", 120000),
  );
  await assert.rejects(
    () => gate.enter(0),
    (error: unknown) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.requestMade, false);
      const plan = retryPlan(error, 3);
      assert.equal(plan.retry, true);
      assert.equal(plan.attempts, 2);
      return true;
    },
  );
});
test("real failing requests stop after three attempts and use exponential backoff", () => {
  const error = new ProviderError("Unavailable", true);
  assert.equal(retryPlan(error, 1, 0).runAt.getTime(), 60000);
  assert.equal(retryPlan(error, 2, 0).runAt.getTime(), 120000);
  assert.equal(retryPlan(error, 3, 0).retry, false);
});
test("parallel calls reserve separate request slots", async () => {
  const gate = new RequestGate();
  const start = Date.now();
  const times = await Promise.all(
    [0, 1, 2].map(async () => {
      await gate.enter(25);
      return Date.now() - start;
    }),
  );
  assert.ok(times[1] >= 20);
  assert.ok(times[2] >= 45);
});

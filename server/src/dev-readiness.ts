import { setTimeout as delay } from "node:timers/promises";

export async function waitForDevelopmentApi(
  target: string,
  { timeoutMs = 90000, intervalMs = 300 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL("/api/health/live", target), {
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(2000, deadline - Date.now())),
        ),
      });
      const data = await response.json();
      if (response.ok && data.status === "live") return;
    } catch {
      // Imports and watcher restarts can briefly leave the listener unavailable.
    }
    await delay(Math.max(1, Math.min(intervalMs, deadline - Date.now())));
  }
  throw new Error(
    `API did not start at ${target}. Check the [api] terminal output; the frontend was not started.`,
  );
}

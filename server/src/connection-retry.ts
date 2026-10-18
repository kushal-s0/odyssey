// Retry initial connection/initialization failures serially. After a successful
// connection, the MongoDB driver handles temporary topology disconnections.
export function startConnectionRetry(options: {
  connect: () => Promise<boolean>;
  initialize: () => Promise<void>;
  onFailure: (error: unknown, retryMs: number) => void;
  initialDelayMs?: number;
  maxDelayMs?: number;
}) {
  const initialDelay = options.initialDelayMs ?? 5000;
  const maxDelay = options.maxDelayMs ?? 30000;
  let delay = initialDelay;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> = Promise.resolve();
  async function attempt() {
    try {
      const connected = await options.connect();
      if (stopped || !connected) return;
      await options.initialize();
    } catch (error) {
      if (stopped) return;
      options.onFailure(error, delay);
      timer = setTimeout(run, delay);
      delay = Math.min(delay * 2, maxDelay);
    }
  }
  function run() {
    timer = undefined;
    if (!stopped) pending = attempt();
  }
  run();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    async drain() {
      await pending;
    },
  };
}

export function databaseFailureCode(error: unknown): string {
  const codes = new Set<string>();
  function inspect(value: any, depth = 0) {
    if (!value || depth > 5) return;
    if (value.code != null) codes.add(String(value.code));
    inspect(value.cause, depth + 1);
  }
  inspect(error);
  const servers = (error as any)?.reason?.servers;
  if (servers instanceof Map)
    for (const server of servers.values()) inspect(server.error);
  if (codes.has("18")) return "DATABASE_AUTHENTICATION_FAILED";
  if (["ENOTFOUND", "EAI_AGAIN", "ETIMEOUT"].some((code) => codes.has(code)))
    return "DATABASE_DNS_FAILED";
  if (
    [
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR",
    ].some((code) => codes.has(code))
  )
    return "DATABASE_NETWORK_FAILED";
  return "DATABASE_INITIALIZATION_FAILED";
}

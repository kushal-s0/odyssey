import type { Server } from "node:http";
export async function gracefulShutdown(
  server: Server,
  resources: {
    stop: () => void;
    drain: () => Promise<void>;
    disconnect: () => Promise<unknown>;
  },
  timeoutMs = 15000,
) {
  resources.stop();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const closed = new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  try {
    const drained = await Promise.race([
      Promise.all([closed, resources.drain()]).then(() => true),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
    if (!drained) server.closeAllConnections();
    await resources.disconnect();
    return drained;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

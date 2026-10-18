import { createApp } from "./app.js";
import mongoose from "mongoose";
import { gracefulShutdown } from "./lifecycle.js";
import { config } from "./config.js";
import { connectDatabase } from "./db.js";
import { bootstrapAssessor } from "./auth.js";
import { startWorker, stopWorker, drainWorker } from "./processing.js";
import {
  startConnectionRetry,
  databaseFailureCode,
} from "./connection-retry.js";
let stopping = false;
const connection = startConnectionRetry({
  connect: async () => (config.NODE_ENV === "test" ? false : connectDatabase()),
  initialize: async () => {
    await bootstrapAssessor();
    if (stopping) return;
    startWorker();
    console.log("MongoDB Atlas connected.");
  },
  onFailure: (error, retryMs) => {
    console.error(
      `${databaseFailureCode(error)}: Atlas initialization failed. Check database credentials, network access and the Atlas IP allowlist. Retrying in ${retryMs / 1000}s.`,
    );
  },
});
if (!config.MONGODB_URI && config.NODE_ENV !== "test")
  console.log("Atlas is not configured. Set MONGODB_URI to enable accounts.");
const server = createApp().listen(
  config.PORT,
  config.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  () => console.log(`STRIVE API: http://localhost:${config.PORT}`),
);
function shutdown() {
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => process.exit(1), 20000);
  force.unref();
  void gracefulShutdown(server, {
    stop: () => {
      connection.stop();
      stopWorker();
    },
    drain: async () => {
      await Promise.all([connection.drain(), drainWorker()]);
    },
    disconnect: () => mongoose.disconnect(),
  })
    .then((drained) => {
      console.log(
        drained
          ? "API and worker stopped cleanly."
          : "Shutdown deadline reached. Unfinished jobs will recover from their saved leases.",
      );
      process.exit(0);
    })
    .catch(() => {
      console.error("Shutdown failed.");
      process.exit(1);
    });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

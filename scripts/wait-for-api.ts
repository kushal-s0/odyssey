import { fileURLToPath } from "node:url";
import { developmentApiTarget } from "../shared/dev-config.js";
import { waitForDevelopmentApi } from "../server/src/dev-readiness.js";

try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error: any) {
  if (error.code !== "ENOENT") throw error;
}
try {
  const target = developmentApiTarget(process.env);
  console.log(`Waiting for API at ${target} before starting the frontend…`);
  await waitForDevelopmentApi(target);
  console.log("API is listening. Starting the frontend.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "API startup failed.");
  process.exitCode = 1;
}

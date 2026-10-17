import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { artifactSchema, type ModelArtifact } from "./model.js";
import { createModelApp } from "./app.js";
dotenv.config({ quiet: true });
if (process.env.REMOTE_MODEL_RUNTIME !== "true")
  throw new Error(
    "This service is intended for a remote host. Set REMOTE_MODEL_RUNTIME=true only in your cloud deployment. Do not start model inference locally.",
  );
const token = process.env.MODEL_SERVICE_TOKEN ?? "";
if (token.length < 32)
  throw new Error("MODEL_SERVICE_TOKEN needs at least 32 characters.");
let artifact: ModelArtifact | null = null;
if (process.env.MODEL_ARTIFACT_PATH)
  artifact = artifactSchema.parse(
    JSON.parse(await readFile(process.env.MODEL_ARTIFACT_PATH, "utf8")),
  );
const port = Number(process.env.PORT ?? 4100);
createModelApp(artifact, token).listen(port, "0.0.0.0", () =>
  console.log(
    `Remote relevance service listening on ${port}. Trained artefact loaded: ${!!artifact}`,
  ),
);

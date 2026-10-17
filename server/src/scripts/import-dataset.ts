import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { connectDatabase, SubmissionModel, JobModel, saveFile } from "../db.js";
const root = resolve(process.cwd());
const repo = root.endsWith("server") ? resolve(root, "..") : root;
const manifest = JSON.parse(
  await readFile(resolve(repo, "data/manifest.json"), "utf8"),
);
const execute = process.argv.includes("--execute");
const limitIndex = process.argv.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : 55;
if (!Number.isInteger(limit) || limit < 1 || limit > 55)
  throw new Error("--limit must be between 1 and 55.");
const rows = manifest.records.slice(0, limit);
console.log(
  `${rows.length} source files selected. ${execute ? "Importing to Atlas." : "Dry run. Add --execute to save and queue AI processing."}`,
);
if (execute) {
  if (!(await connectDatabase()))
    throw new Error("Configure MONGODB_URI before importing.");
  for (const row of rows) {
    if (await SubmissionModel.exists({ fileHash: row.sha256 })) {
      console.log(`Already imported: ${row.id}`);
      continue;
    }
    const filePath = resolve(repo, row.path);
    if (
      !filePath.startsWith(
        resolve(repo, "data", "extracted") + String.fromCharCode(92),
      ) &&
      !filePath.startsWith(resolve(repo, "data", "extracted") + "/")
    )
      throw new Error("Dataset path must stay in data/extracted.");
    const buffer = await readFile(filePath);
    const mime =
      row.inputType === "pdf"
        ? "application/pdf"
        : row.path.endsWith(".ogg")
          ? "audio/ogg"
          : "video/mp4";
    const fileId = await saveFile(
      buffer,
      `${row.id}${row.path.slice(row.path.lastIndexOf("."))}`,
      mime,
    );
    const doc = await SubmissionModel.create({
      beneficiaryName: `Dataset sample ${row.id.slice(0, 6)}`,
      title: `Imported ${row.language} ${row.inputType}`,
      inputType: row.inputType,
      language:
        (
          {
            English: "en-IN",
            Hindi: "hi-IN",
            Marathi: "mr-IN",
            Telugu: "te-IN",
            Bengali: "bn-IN",
            Odia: "od-IN",
          } as Record<string, string>
        )[row.language] ?? "auto",
      cohortId: null,
      cohortName: null,
      cohortSynthetic: false,
      status: "queued",
      stage: "Waiting to process",
      fileId,
      fileName: row.sourcePath.split("/").pop(),
      fileMime: mime,
      fileHash: row.sha256,
      sourceFamily: row.groupReviewed ? row.sourceFamily : null,
      history: [],
    });
    await JobModel.create({ submissionId: doc._id });
    console.log(`Imported: ${row.id}`);
  }
  await mongoose.disconnect();
}

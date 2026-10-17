import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { connectDatabase, AnnotationModel } from "../db.js";
if (!(await connectDatabase()))
  throw new Error(
    "Configure MongoDB Atlas to export reviewed training labels.",
  );
const rows = await AnnotationModel.find().lean();
const output = rows.map((r) => ({
  id: String(r._id),
  submissionId: String(r.submissionId),
  field: r.field,
  businessContext: r.businessContext,
  question: r.question,
  answer: r.answer,
  label: r.label,
  groupId: r.groupId,
  language: r.language,
}));
const root = process.cwd().endsWith("server")
  ? resolve(process.cwd(), "..")
  : process.cwd();
await mkdir(resolve(root, "data/training"), { recursive: true });
await writeFile(
  resolve(root, "data/training/reviewed-answers.jsonl"),
  output.map((r) => JSON.stringify(r)).join("\n"),
);
console.log(
  `Exported ${output.length} reviewed answers. No automatic labels were added.`,
);
await mongoose.disconnect();

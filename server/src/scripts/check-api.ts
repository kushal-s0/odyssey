import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { PDFDocument } from "pdf-lib";
import { config } from "../config.js";
import { assess } from "../domain/assessment.js";
import {
  SubmissionModel,
  UserModel,
  SessionModel,
  JobModel,
  CohortModel,
  ClarificationModel,
  AnnotationModel,
  LocalContextModel,
  AuditModel,
  connectDatabase,
  saveFile,
  bucket,
} from "../db.js";

// Only generated fixtures are written or sent to AI. No existing submission is
// retried, modified or deleted. Password/session mutations use a temporary user.
const root = process.cwd().endsWith("server")
  ? resolve(process.cwd(), "..")
  : process.cwd();
const base = `http://127.0.0.1:${config.PORT}/api`,
  cookies: Record<string, string> = {},
  checks: any[] = [];
const recordIds: string[] = [],
  fileIds: mongoose.Types.ObjectId[] = [];
let userId: string | undefined, cohortId: string | undefined;
const nonce = randomUUID(),
  email = `api-audit-${nonce}@example.test`,
  password = `Qa-${randomUUID()}-9z`,
  newPassword = `Qa-${randomUUID()}-8y`;
async function call(
  method: string,
  template: string,
  path = template,
  body?: unknown,
  actor = "admin",
  expected = [200],
  validate?: (value: any, response: Response) => boolean,
) {
  try {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(cookies[actor] ? { Cookie: cookies[actor] } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(120000),
    });
    const cookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith("strive_session="));
    if (cookie) cookies[actor] = cookie.split(";")[0]!;
    const type = response.headers.get("content-type") ?? "";
    const value = type.includes("application/json")
      ? await response.json()
      : type.includes("pdf")
        ? Buffer.from(await response.arrayBuffer())
        : await response.text();
    const ok =
      expected.includes(response.status) &&
      (!validate || validate(value, response));
    checks.push({
      method,
      path: template,
      http: response.status,
      ok,
      ...(!ok
        ? {
            code: value?.code ?? "RESPONSE_CHECK_FAILED",
            requestId: response.headers.get("X-Request-ID"),
          }
        : {}),
    });
    return { status: response.status, value, ok };
  } catch {
    checks.push({ method, path: template, ok: false, code: "REQUEST_FAILED" });
    return { status: 0, value: null, ok: false };
  }
}
const report: any = {
  checkedAt: new Date().toISOString(),
  scope:
    "All registered application routes; temporary synthetic fixtures only. Queue acceptance is checked separately from hosted inference.",
};
try {
  const routes = await readFile(resolve(root, "server/src/routes.ts"), "utf8"),
    local = await readFile(
      resolve(root, "server/src/local-context-routes.ts"),
      "utf8",
    );
  const inventory = [
    ...[
      ...routes.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g),
    ].map((m) => ({ method: m[1]!.toUpperCase(), path: m[2]! })),
    ...[
      ...local.matchAll(/localContextRouter\.(get|post|delete)\(\s*"([^"]+)"/g),
    ].map((m) => ({
      method: m[1]!.toUpperCase(),
      path: "/submissions/:id/local-context" + (m[2] === "/" ? "" : m[2]),
    })),
  ];
  report.inventory = inventory;
  const health = await call("GET", "/health", undefined, undefined, "public");
  await call("GET", "/health/live", undefined, undefined, "public");
  await call("GET", "/health/ready", undefined, undefined, "public");
  await call("GET", "/session", undefined, undefined, "public");
  await call(
    "GET",
    "/examples",
    undefined,
    undefined,
    "public",
    config.ENABLE_EXAMPLES ? [200] : [404],
  );
  if (!health.value?.database) throw new Error("DATABASE_UNAVAILABLE");
  const login = await call(
    "POST",
    "/auth/login",
    undefined,
    { email: config.ASSESSOR_EMAIL, password: config.ASSESSOR_PASSWORD },
    "admin",
    [200],
    (v) => v.user?.role === "assessor",
  );
  if (!login.ok) throw new Error("ASSESSOR_SESSION_UNAVAILABLE");
  const signup = await call(
    "POST",
    "/auth/register",
    undefined,
    { name: "Synthetic API audit", email, password },
    "user",
    [200, 201],
    (v) => v.user?.role === "entrepreneur",
  );
  if (!signup.ok) throw new Error("TEMPORARY_ACCOUNT_UNAVAILABLE");
  userId = signup.value.user.id;
  await connectDatabase();
  await call("GET", "/dashboard");
  await call("GET", "/cohorts");
  await call("GET", "/submissions");
  const cohort = await call(
    "POST",
    "/cohorts",
    undefined,
    { name: `SYNTHETIC API AUDIT ${nonce}` },
    "admin",
    [201],
  );
  cohortId = cohort.value?.id;
  if (!cohortId) throw new Error("FIXTURE_COHORT_UNAVAILABLE");
  await CohortModel.updateOne({ _id: cohortId }, { $set: { synthetic: true } });
  const sourceText =
    "SYNTHETIC API AUDIT. Products: prepared lunch meals. Customers: nearby office workers. Problem: affordable lunch. Location: Pune. Projected monthly sales: INR 30000. Monthly costs not provided.";
  const submitted = await call(
    "POST",
    "/submissions",
    undefined,
    {
      beneficiaryName: "Synthetic API audit",
      title: "SYNTHETIC API audit intake",
      inputType: "text",
      language: "en-IN",
      originalText: sourceText,
    },
    "user",
    [202],
    (v) => v.submission?.status === "queued",
  );
  if (submitted.value?.submission?.id) {
    const intakeId = submitted.value.submission.id;
    recordIds.push(intakeId);
    await JobModel.updateOne(
      { submissionId: intakeId, status: "queued" },
      { $set: { runAt: new Date(Date.now() + 600000) } },
    );
  }
  const values = {
    products: "prepared lunch meals",
    customers: "nearby office workers",
    problem: "affordable lunch",
    location: "Pune",
    monthlyRevenue: "INR 30000",
  };
  const segments = Object.entries(values).map(([id, text]) => ({
    id,
    originalText: text,
    englishText: text,
    kind: "pdf" as const,
    page: 1,
    startSeconds: null,
    endSeconds: null,
    verified: false,
  }));
  const assessment = assess({
    fields: Object.entries(values).map(([key, value]) => ({
      key: key as any,
      value,
      status: "supported",
      evidenceIds: [key],
      reason: "Synthetic fixture quotation",
    })),
    segments,
    language: "en-IN",
    providerModel: "SYNTHETIC API FIXTURE - no model claim",
  });
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText(sourceText, { x: 30, y: 700, size: 8 });
  const bytes = Buffer.from(await pdf.save()),
    fileId = await saveFile(bytes, "synthetic-api.pdf", "application/pdf");
  fileIds.push(fileId);
  const doc = await SubmissionModel.create({
    ownerId: userId,
    beneficiaryName: "Synthetic API audit",
    title: "SYNTHETIC API audit fixture",
    inputType: "pdf",
    language: "en-IN",
    status: "needs_review",
    stage: "Synthetic seeded assessment",
    fileId,
    fileName: "synthetic-api.pdf",
    fileMime: "application/pdf",
    assessment,
    history: [],
  });
  const recordId = String(doc._id);
  recordIds.push(recordId);
  const path = `/submissions/${recordId}`;
  let current = (await call("GET", "/submissions/:id", path)).value.submission;
  await call(
    "GET",
    "/submissions/:id/source",
    path + "/source",
    undefined,
    "user",
    [200],
    (v) => Buffer.isBuffer(v) && v.equals(bytes),
  );
  await call("POST", "/submissions/:id/cohort", path + "/cohort", {
    cohortId,
    updatedAt: current.updatedAt,
  });
  await call(
    "GET",
    "/submissions/:id/decision-support",
    path + "/decision-support",
  );
  await call("GET", "/submissions/:id/similar", path + "/similar");
  await call("GET", "/submissions/:id/local-context", path + "/local-context");
  await call(
    "POST",
    "/submissions/:id/local-context",
    path + "/local-context",
    {
      place: { name: "Synthetic confirmed Pune point", lat: 18.52, lon: 73.85 },
      category: "food",
      radius: 1000,
      revision: 0,
    },
  );
  const observed = await call(
    "POST",
    "/submissions/:id/local-context/observations",
    path + "/local-context/observations",
    {
      name: "SYNTHETIC audit observation - not a real competitor",
      category: "food",
      lat: 18.5201,
      lon: 73.8501,
      sourceUrl: "https://www.openstreetmap.org/",
      note: "SYNTHETIC API check only; this is not a real business observation.",
      checked: false,
    },
    "admin",
    [201],
  );
  const observationId = observed.value?.context?.observations?.[0]?.id;
  if (observationId)
    await call(
      "DELETE",
      "/submissions/:id/local-context/observations/:observationId",
      path + "/local-context/observations/" + observationId,
    );
  await call("GET", "/locations/search", "/locations/search?q=Pune");
  await call(
    "POST",
    "/locations/businesses",
    undefined,
    { lat: 18.52, lon: 73.85, category: "food", radius: 1000 },
    "admin",
    [200],
    (v) => v.status === "available" && Array.isArray(v.businesses),
  );
  const clarified = await call(
    "POST",
    "/submissions/:id/clarifications",
    path + "/clarifications",
    {
      field: "monthlyCosts",
      answer: "Monthly operating costs: INR 20000 per month.",
      language: "en-IN",
      version: current.assessment.version,
    },
    "user",
    [200],
    (v) =>
      v.submission?.assessment?.fields.some(
        (f: any) => f.key === "monthlyCosts" && f.status === "supported",
      ),
  );
  if (clarified.ok) {
    current = clarified.value.submission;
    const source = current.assessment.segments.find(
      (s: any) => s.clarificationId,
    );
    if (source)
      await call(
        "GET",
        "/submissions/:id/clarifications/:clarificationId/source",
        path + `/clarifications/${source.clarificationId}/source`,
        undefined,
        "user",
        [200],
        (v) => typeof v === "string" && v.includes("INR 20000"),
      );
  } else {
    const retained = await ClarificationModel.create({
      submissionId: recordId,
      field: "monthlyCosts",
      originalText: "SYNTHETIC retained clarification",
      status: "received",
    });
    await call(
      "GET",
      "/submissions/:id/clarifications/:clarificationId/source",
      path + `/clarifications/${retained._id}/source`,
      undefined,
      "user",
      [200],
      (v) => v === "SYNTHETIC retained clarification",
    );
  }
  const verified = await call(
    "POST",
    "/submissions/:id/verify",
    path + "/verify",
    { version: current.assessment.version, segmentIds: ["products"] },
  );
  if (verified.ok) current = verified.value.submission;
  await call("POST", "/submissions/:id/review", path + "/review", {
    decision: "mentoring",
    note: "SYNTHETIC API review of supplied evidence; a human should validate the customer and operating assumptions.",
    reasonCodes: ["market_validation"],
    nextAction: "Validate customer demand with a small local survey.",
    sourceReviewed: true,
    evidenceIds: ["products"],
    version: current.assessment.version,
  });
  await call("GET", "/training/annotations");
  await call(
    "GET",
    "/training/model",
    undefined,
    undefined,
    "admin",
    [200],
    (v) => typeof v.ready === "boolean",
  );
  await call(
    "POST",
    "/training/annotations",
    undefined,
    {
      submissionId: recordId,
      field: "products",
      label: 0,
      groupId: `synthetic-api-${nonce}`,
    },
    "admin",
    [201],
  );
  const failed = await SubmissionModel.create({
    ownerId: userId,
    beneficiaryName: "Synthetic API audit",
    title: "SYNTHETIC retry fixture",
    inputType: "text",
    language: "en-IN",
    originalText: sourceText,
    status: "failed",
    stage: "Synthetic retry check",
    history: [],
  });
  const failedId = String(failed._id);
  recordIds.push(failedId);
  await call(
    "POST",
    "/submissions/:id/retry",
    `/submissions/${failedId}/retry`,
    {},
    "user",
    [200],
    (v) => v.submission?.status === "queued",
  );
  await JobModel.updateOne(
    { submissionId: failedId, status: "queued" },
    { $set: { runAt: new Date(Date.now() + 600000) } },
  );
  await call("POST", "/auth/logout-all", undefined, {}, "user");
  await call("POST", "/auth/login", undefined, { email, password }, "user");
  await call(
    "POST",
    "/auth/password",
    undefined,
    { currentPassword: password, newPassword },
    "user",
  );
  await call(
    "POST",
    "/auth/login",
    undefined,
    { email, password: newPassword },
    "user",
  );
  await call("POST", "/auth/logout", undefined, {}, "user");
  await call("POST", "/auth/logout", undefined, {}, "admin");
} catch (error) {
  report.blocker =
    error instanceof Error && /^[A-Z_]+$/.test(error.message)
      ? error.message
      : "AUDIT_COULD_NOT_FINISH";
} finally {
  try {
    if (mongoose.connection.readyState === 1) {
      if (recordIds.length) {
        const filter = { submissionId: { $in: recordIds } };
        await JobModel.deleteMany(filter);
        await ClarificationModel.deleteMany(filter);
        await AnnotationModel.deleteMany(filter);
        await LocalContextModel.deleteMany(filter);
        await AuditModel.deleteMany(filter);
        await SubmissionModel.deleteMany({ _id: { $in: recordIds } });
      }
      for (const fileId of fileIds) await bucket.delete(fileId).catch(() => {});
      if (cohortId) await CohortModel.deleteOne({ _id: cohortId });
      if (userId) {
        await SessionModel.deleteMany({ userId });
        await UserModel.deleteOne({ _id: userId, email });
      }
      report.temporaryFixturesRemoved = true;
    }
  } catch {
    report.temporaryFixturesRemoved = false;
  }
  if (cookies.admin)
    await fetch(base + "/auth/logout", {
      method: "POST",
      headers: { Cookie: cookies.admin },
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  await mongoose.disconnect().catch(() => {});
  report.checks = checks;
  report.covered =
    report.inventory?.filter((r: any) =>
      checks.some((c) => c.method === r.method && c.path === r.path && c.ok),
    ) ?? [];
  report.unverified =
    report.inventory?.filter(
      (r: any) =>
        !report.covered.some(
          (c: any) => c.method === r.method && c.path === r.path,
        ),
    ) ?? [];
  report.ok =
    !report.blocker &&
    checks.every((c) => c.ok) &&
    report.unverified.length === 0 &&
    report.temporaryFixturesRemoved;
  await mkdir(resolve(root, ".planning"), { recursive: true });
  await writeFile(
    resolve(root, ".planning/api-endpoint-check.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      ok: report.ok,
      coveredRoutes: report.covered.length,
      totalRoutes: report.inventory?.length ?? 0,
      unverifiedRoutes: report.unverified,
      failedChecks: checks.filter((c) => !c.ok),
      blocker: report.blocker ?? null,
      temporaryFixturesRemoved: report.temporaryFixturesRemoved ?? null,
    }),
  );
  if (!report.ok) process.exitCode = 1;
}

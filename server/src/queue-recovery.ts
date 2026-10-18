import { JobModel, SubmissionModel } from "./db.js";

// Repair a stale queue label only when no runnable job or worker lease exists.
// Never create duplicate work or silently reset exhausted attempt counters.
export async function reconcileQueuedSubmissions(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 60000);
  const waiting = await SubmissionModel.find({
    status: "queued",
    updatedAt: { $lt: staleBefore },
  })
    .select("_id assessment")
    .limit(20)
    .lean();
  for (const record of waiting) {
    const active = await JobModel.exists({
      submissionId: record._id,
      $or: [
        { status: "queued", attempts: { $lt: 3 } },
        { status: "processing" },
      ],
    });
    if (active) continue;
    const latest = await JobModel.findOne({ submissionId: record._id })
      .sort({ createdAt: -1 })
      .select("status attempts error errorCode errorProvider")
      .lean();
    if (latest?.status === "queued" && Number(latest.attempts) >= 3)
      await JobModel.updateOne(
        { _id: latest._id, status: "queued", attempts: { $gte: 3 } },
        { $set: { status: "failed" } },
      );
    const completed = latest?.status === "done" && !!record.assessment;
    await SubmissionModel.updateOne(
      { _id: record._id, status: "queued", updatedAt: { $lt: staleBefore } },
      {
        $set: completed
          ? {
              status: record.assessment.reviewRequired
                ? "needs_review"
                : "ready",
              stage: "Assessment complete",
              error: null,
              errorCode: null,
              errorProvider: null,
              nextRetryAt: null,
            }
          : {
              status: "failed",
              stage: "Needs attention",
              error:
                "Processing stopped before the assessment completed. Your original is saved. Use Retry processing to resume.",
              errorCode: "PROCESSING_INTERRUPTED",
              errorProvider: latest?.errorProvider ?? null,
              nextRetryAt: null,
            },
      },
    );
  }
}

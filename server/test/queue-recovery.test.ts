import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JobModel, SubmissionModel } from "../src/db.js";
import { reconcileQueuedSubmissions } from "../src/queue-recovery.js";
const original = {
  find: SubmissionModel.find,
  exists: JobModel.exists,
  latest: JobModel.findOne,
  update: SubmissionModel.updateOne,
  jobUpdate: JobModel.updateOne,
};
afterEach(() => {
  SubmissionModel.find = original.find;
  JobModel.exists = original.exists;
  JobModel.findOne = original.latest;
  SubmissionModel.updateOne = original.update;
  JobModel.updateOne = original.jobUpdate;
});
function fixtures(latest: any, active = false, assessment?: any) {
  const writes: any[] = [],
    jobWrites: any[] = [];
  SubmissionModel.find = ((filter: any) => {
    assert.equal(filter.status, "queued");
    assert.ok(filter.updatedAt.$lt instanceof Date);
    return {
      select: () => ({
        limit: () => ({ lean: async () => [{ _id: "saved", assessment }] }),
      }),
    };
  }) as any;
  JobModel.exists = (async () => (active ? { _id: "active" } : null)) as any;
  JobModel.findOne = (() => ({
    sort: () => ({ select: () => ({ lean: async () => latest }) }),
  })) as any;
  SubmissionModel.updateOne = (async (filter: any, update: any) => {
    writes.push({ filter, update });
    return { modifiedCount: 1 };
  }) as any;
  JobModel.updateOne = (async (filter: any, update: any) => {
    jobWrites.push({ filter, update });
    return { modifiedCount: 1 };
  }) as any;
  return { writes, jobWrites };
}
test("a failed job cannot leave its submission waiting forever for a backup provider", async () => {
  const { writes, jobWrites } = fixtures({
    _id: "failed-job",
    status: "failed",
    attempts: 3,
    errorProvider: "groq",
  });
  await reconcileQueuedSubmissions();
  assert.equal(writes[0].update.$set.status, "failed");
  assert.equal(writes[0].update.$set.errorCode, "PROCESSING_INTERRUPTED");
  assert.match(writes[0].update.$set.error, /Retry processing/);
  assert.equal(writes[0].filter.status, "queued");
  assert.equal(
    jobWrites.length,
    0,
    "exhausted jobs are not silently restarted",
  );
});
test("a runnable or leased job is never duplicated or marked failed", async () => {
  const { writes, jobWrites } = fixtures(null, true);
  await reconcileQueuedSubmissions();
  assert.equal(writes.length, 0);
  assert.equal(jobWrites.length, 0);
});
test("a missing job becomes actionable while completed assessments retain their existing result", async () => {
  let state = fixtures(null);
  await reconcileQueuedSubmissions();
  assert.equal(state.writes[0].update.$set.status, "failed");
  state = fixtures({ status: "done" }, false, { reviewRequired: true });
  await reconcileQueuedSubmissions();
  assert.equal(state.writes[0].update.$set.status, "needs_review");
  assert.equal(state.writes[0].update.$set.error, null);
  assert.equal(
    state.writes[0].update.$set.assessment,
    undefined,
    "saved evidence is not rewritten",
  );
});
test("unclaimable legacy queued jobs keep their attempt count and expose retry", async () => {
  const { writes, jobWrites } = fixtures({
    _id: "exhausted",
    status: "queued",
    attempts: 3,
  });
  await reconcileQueuedSubmissions();
  assert.equal(writes[0].update.$set.status, "failed");
  assert.equal(jobWrites[0].update.$set.status, "failed");
  assert.equal(jobWrites[0].update.$set.attempts, undefined);
});

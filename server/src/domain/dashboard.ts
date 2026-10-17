import { SubmissionModel } from "../db.js";
import { submissionScope } from "../auth.js";
import type { DashboardSummary, WorkspaceUser } from "../../../shared/types.js";
export async function dashboardSummary(
  user: WorkspaceUser,
): Promise<DashboardSummary> {
  const [result] = await SubmissionModel.aggregate([
    { $match: submissionScope(user) },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              processing: {
                $sum: {
                  $cond: [{ $in: ["$status", ["queued", "processing"]] }, 1, 0],
                },
              },
              assessed: {
                $sum: {
                  $cond: [
                    { $ne: [{ $ifNull: ["$assessment", null] }, null] },
                    1,
                    0,
                  ],
                },
              },
              scored: {
                $sum: { $cond: [{ $isNumber: "$assessment.score" }, 1, 0] },
              },
              meanCompleteness: { $avg: "$assessment.completeness" },
              awaitingReview: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$status", "needs_review"] },
                        { $eq: [{ $ifNull: ["$review", null] }, null] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              needsClarification: {
                $sum: {
                  $cond: [
                    {
                      $gt: [
                        { $size: { $ifNull: ["$assessment.questions", []] } },
                        0,
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              failed: {
                $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
              },
              meanScore: { $avg: "$assessment.score" },
            },
          },
        ],
        latest: [
          { $match: { "assessment.score": { $type: "number" } } },
          { $sort: { updatedAt: -1 } },
          { $limit: 1 },
          {
            $project: {
              _id: 1,
              score: "$assessment.score",
              completeness: "$assessment.completeness",
            },
          },
        ],
      },
    },
  ]);
  const totals = result?.totals?.[0],
    latest = result?.latest?.[0];
  return {
    scope: user.role === "entrepreneur" ? "personal" : "programme",
    total: totals?.total ?? 0,
    processing: totals?.processing ?? 0,
    assessed: totals?.assessed ?? 0,
    scored: totals?.scored ?? 0,
    meanCompleteness:
      totals?.meanCompleteness == null
        ? 0
        : Math.round(totals.meanCompleteness),
    awaitingReview: totals?.awaitingReview ?? 0,
    needsClarification: totals?.needsClarification ?? 0,
    failed: totals?.failed ?? 0,
    meanScore: totals?.meanScore == null ? null : Math.round(totals.meanScore),
    latestScore: latest?.score ?? null,
    latestCompleteness: latest?.completeness ?? null,
    latestSubmissionId: latest ? String(latest._id) : null,
  };
}

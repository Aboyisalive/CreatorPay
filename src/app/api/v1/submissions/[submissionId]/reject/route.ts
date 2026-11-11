import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS, REVIEWERS } from "@/lib/rbac";
import { notFound, conflict } from "@/lib/errors";
import { rejectSubmissionSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/submissions/[submissionId]/reject">,
) {
  return withApi(request, async () => {
    const { submissionId } = await ctx.params;
    const user = await requireUser();
    const input = rejectSubmissionSchema.parse(await readJson(request));

    const submission = await db.submission.findUnique({
      where: { id: submissionId },
      include: {
        campaign: { include: { workspace: true } },
        participant: { include: { creatorProfile: true } },
        deliverable: { select: { name: true } },
      },
    });
    if (!submission) {
      throw notFound("Submission not found.");
    }

    const context = await requireWorkspace(user, submission.campaign.workspaceId);
    assertRole(context.role, [...CAMPAIGN_MANAGERS, ...REVIEWERS]);

    if (submission.status === "REJECTED") {
      throw conflict("This submission is already rejected.");
    }
    if (submission.status === "APPROVED") {
      throw conflict("Cannot reject an already-approved submission.");
    }

    const updated = await db.submission.update({
      where: { id: submissionId },
      data: {
        status: "REJECTED",
        reviewerId: user.id,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote,
      },
    });

    await recordAudit({
      workspaceId: submission.campaign.workspaceId,
      actorUserId: user.id,
      action: "submission.rejected",
      entityType: "Submission",
      entityId: submissionId,
      metadata: { campaignId: submission.campaignId, previousStatus: submission.status },
    });

    await notify({
      userIds: [submission.participant.creatorProfile.userId],
      workspaceId: submission.campaign.workspaceId,
      type: "submission.rejected",
      title: `Submission rejected: ${submission.deliverable.name}`,
      body: input.reviewNote ?? "The business rejected this submission.",
      entityType: "Submission",
      entityId: submissionId,
    });

    return json({ submission: updated });
  });
}

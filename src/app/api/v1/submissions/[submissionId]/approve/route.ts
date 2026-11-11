import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS, REVIEWERS } from "@/lib/rbac";
import { notFound, conflict } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/submissions/[submissionId]/approve">,
) {
  return withApi(request, async () => {
    const { submissionId } = await ctx.params;
    const user = await requireUser();

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

    if (submission.status === "APPROVED") {
      throw conflict("This submission is already approved.");
    }
    if (submission.status === "REJECTED") {
      throw conflict("Cannot approve a rejected submission.");
    }

    const updated = await db.submission.update({
      where: { id: submissionId },
      data: {
        status: "APPROVED",
        reviewerId: user.id,
        reviewedAt: new Date(),
        reviewNote: null,
      },
    });

    await recordAudit({
      workspaceId: submission.campaign.workspaceId,
      actorUserId: user.id,
      action: "submission.approved",
      entityType: "Submission",
      entityId: submissionId,
      metadata: { campaignId: submission.campaignId, previousStatus: submission.status },
    });

    await notify({
      userIds: [submission.participant.creatorProfile.userId],
      workspaceId: submission.campaign.workspaceId,
      type: "submission.approved",
      title: `Submission approved: ${submission.deliverable.name}`,
      body: "The business approved your deliverable evidence.",
      entityType: "Submission",
      entityId: submissionId,
    });

    return json({ submission: updated });
  });
}

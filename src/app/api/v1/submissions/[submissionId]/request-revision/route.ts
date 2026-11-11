import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS, REVIEWERS } from "@/lib/rbac";
import { notFound, conflict } from "@/lib/errors";
import { reviewSubmissionSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/submissions/[submissionId]/request-revision">,
) {
  return withApi(request, async () => {
    const { submissionId } = await ctx.params;
    const user = await requireUser();
    const input = reviewSubmissionSchema.parse(await readJson(request));

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
      throw conflict("Cannot request revision on an approved submission.");
    }

    const updated = await db.submission.update({
      where: { id: submissionId },
      data: {
        status: "REVISION_REQUESTED",
        reviewerId: user.id,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote ?? "Revision requested.",
      },
    });

    await recordAudit({
      workspaceId: submission.campaign.workspaceId,
      actorUserId: user.id,
      action: "submission.revision_requested",
      entityType: "Submission",
      entityId: submissionId,
      metadata: { campaignId: submission.campaignId, previousStatus: submission.status },
    });

    await notify({
      userIds: [submission.participant.creatorProfile.userId],
      workspaceId: submission.campaign.workspaceId,
      type: "submission.revision_requested",
      title: `Revision requested: ${submission.deliverable.name}`,
      body: input.reviewNote ?? "The business asked for changes to your submission.",
      entityType: "Submission",
      entityId: submissionId,
    });

    return json({ submission: updated });
  });
}

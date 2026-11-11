import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/submissions/[submissionId]">,
) {
  return withApi(request, async () => {
    const { submissionId } = await ctx.params;
    const user = await requireUser();

    const submission = await db.submission.findUnique({
      where: { id: submissionId },
      include: {
        campaign: { select: { id: true, name: true, workspaceId: true } },
        deliverable: true,
        participant: {
          include: {
            creatorProfile: {
              include: { user: { select: { email: true, name: true } } },
            },
          },
        },
        reviewer: { select: { name: true, email: true } },
      },
    });
    if (!submission) {
      throw notFound("Submission not found.");
    }

    // Visible to workspace members (business side) or the submitting creator.
    const profile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    const isSubmitter =
      profile && profile.id === submission.participant.creatorProfileId;

    if (!isSubmitter) {
      await requireWorkspace(user, submission.campaign.workspaceId);
    }

    return json({
      submission: {
        id: submission.id,
        status: submission.status,
        evidenceUrl: submission.evidenceUrl,
        evidenceText: submission.evidenceText,
        note: submission.note,
        reviewNote: submission.reviewNote,
        submittedAt: submission.submittedAt,
        reviewedAt: submission.reviewedAt,
        campaign: submission.campaign,
        deliverable: submission.deliverable,
        creator: {
          displayName: submission.participant.creatorProfile.displayName,
          email: submission.participant.creatorProfile.user.email,
        },
        reviewer: submission.reviewer,
      },
    });
  });
}

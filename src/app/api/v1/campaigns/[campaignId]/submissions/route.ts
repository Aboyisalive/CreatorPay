import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound, badRequest, forbidden } from "@/lib/errors";
import { createSubmissionSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { notifyWorkspace } from "@/lib/notify";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/submissions">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { workspaceId: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }
    await requireWorkspace(user, campaign.workspaceId);

    const submissions = await db.submission.findMany({
      where: { campaignId },
      orderBy: { submittedAt: "desc" },
      include: {
        participant: {
          include: {
            creatorProfile: {
              include: { user: { select: { email: true, name: true } } },
            },
          },
        },
        deliverable: { select: { name: true, type: true, evidenceType: true } },
      },
    });

    return json({ submissions });
  });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/submissions">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();
    const body = await readJson(request);
    const deliverableId = (body as Record<string, unknown>).deliverableId;
    const input = createSubmissionSchema.parse(body);

    if (!deliverableId || typeof deliverableId !== "string") {
      throw badRequest("deliverableId is required.");
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { workspace: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }
    if (campaign.status !== "PUBLISHED") {
      throw badRequest("Campaign is not open for submissions.");
    }

    const creatorProfile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!creatorProfile) {
      throw forbidden("Only creators can submit deliverables.");
    }

    const participant = await db.campaignParticipant.findFirst({
      where: { campaignId, creatorProfileId: creatorProfile.id, status: "ACTIVE" },
    });
    if (!participant) {
      throw forbidden("You are not an active participant in this campaign.");
    }

    const deliverable = await db.deliverableRequirement.findFirst({
      where: { id: deliverableId, campaignId },
    });
    if (!deliverable) {
      throw notFound("Deliverable not found for this campaign.");
    }

    const submission = await db.submission.create({
      data: {
        campaignId,
        participantId: participant.id,
        deliverableId,
        evidenceUrl: input.evidenceUrl,
        evidenceText: input.evidenceText,
        note: input.note,
        status: "SUBMITTED",
      },
    });

    await recordAudit({
      workspaceId: campaign.workspaceId,
      actorUserId: user.id,
      action: "submission.created",
      entityType: "Submission",
      entityId: submission.id,
      metadata: { campaignId, deliverableId, participantId: participant.id },
    });

    await notifyWorkspace(
      campaign.workspaceId,
      ["OWNER", "ADMIN", "CAMPAIGN_MANAGER"],
      {
        type: "submission.created",
        title: `New submission: ${deliverable.name}`,
        body: `${creatorProfile.displayName} submitted evidence for review.`,
        entityType: "Submission",
        entityId: submission.id,
      },
    );

    return json({ submission }, 201);
  });
}

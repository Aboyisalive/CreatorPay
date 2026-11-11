import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS, REVIEWERS } from "@/lib/rbac";
import { notFound, conflict } from "@/lib/errors";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";

const rejectSchema = z.object({
  reviewNote: z.string().trim().min(1, "Provide a reason for rejection.").max(2000),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/events/[eventId]/reject">,
) {
  return withApi(request, async () => {
    const { eventId } = await ctx.params;
    const user = await requireUser();
    const input = rejectSchema.parse(await readJson(request));

    const event = await db.conversionEvent.findUnique({
      where: { id: eventId },
      include: { campaign: { include: { workspace: true } } },
    });
    if (!event) {
      throw notFound("Event not found.");
    }

    const context = await requireWorkspace(user, event.campaign.workspaceId);
    assertRole(context.role, [...CAMPAIGN_MANAGERS, ...REVIEWERS]);

    if (event.verificationStatus === "REJECTED") {
      throw conflict("This event is already rejected.");
    }
    if (event.verificationStatus === "VERIFIED") {
      throw conflict("Cannot reject a verified event.");
    }

    const updated = await db.conversionEvent.update({
      where: { id: eventId },
      data: {
        verificationStatus: "REJECTED",
        eligibilityStatus: "INELIGIBLE",
        reviewReason: input.reviewNote,
        updatedAt: new Date(),
      },
    });

    await recordAudit({
      workspaceId: event.campaign.workspaceId,
      actorUserId: user.id,
      action: "event.rejected",
      entityType: "ConversionEvent",
      entityId: eventId,
      metadata: { campaignId: event.campaignId, previousStatus: event.verificationStatus },
    });

    return json({ event: updated });
  });
}

import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { notFound, conflict } from "@/lib/errors";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";

const markEligibleSchema = z.object({
  reviewNote: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/events/[eventId]/mark-eligible">,
) {
  return withApi(request, async () => {
    const { eventId } = await ctx.params;
    const user = await requireUser();
    const input = markEligibleSchema.parse(await readJson(request));

    const event = await db.conversionEvent.findUnique({
      where: { id: eventId },
      include: { campaign: { include: { workspace: true } } },
    });
    if (!event) {
      throw notFound("Event not found.");
    }

    const context = await requireWorkspace(user, event.campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (event.eligibilityStatus === "ELIGIBLE") {
      throw conflict("This event is already eligible.");
    }
    if (event.eligibilityStatus === "INELIGIBLE" && event.verificationStatus !== "VERIFIED") {
      throw conflict("Verify the event first before marking it eligible.");
    }

    const updated = await db.conversionEvent.update({
      where: { id: eventId },
      data: {
        eligibilityStatus: "ELIGIBLE",
        reviewReason: input.reviewNote ?? event.reviewReason,
        updatedAt: new Date(),
      },
    });

    await recordAudit({
      workspaceId: event.campaign.workspaceId,
      actorUserId: user.id,
      action: "event.marked_eligible",
      entityType: "ConversionEvent",
      entityId: eventId,
      metadata: { campaignId: event.campaignId, previousStatus: event.eligibilityStatus },
    });

    return json({ event: updated });
  });
}

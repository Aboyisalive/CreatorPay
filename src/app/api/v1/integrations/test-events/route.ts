import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { notFound, conflict } from "@/lib/errors";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";

const testEventSchema = z.object({
  campaignId: z.string().min(1),
  eventType: z.enum([
    "REGISTRATION",
    "LEAD",
    "PURCHASE",
    "SUBSCRIPTION",
    "APPLICATION",
    "OTHER",
  ]),
  externalEventId: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const input = testEventSchema.parse(await readJson(request));

    const campaign = await db.campaign.findUnique({
      where: { id: input.campaignId },
      include: { workspace: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (!["PUBLISHED", "CLOSED"].includes(campaign.status)) {
      throw conflict("Campaigns only accept events while published or closed.");
    }

    const externalEventId =
      input.externalEventId || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Test events are always marked ineligible
    const event = await db.conversionEvent.create({
      data: {
        campaignId: campaign.id,
        participantId: null,
        externalEventId,
        eventType: input.eventType,
        occurredAt: new Date(),
        source: "API",
        verificationStatus: "VERIFIED",
        eligibilityStatus: "INELIGIBLE",
        reviewReason: "Test event: excluded from reward calculations.",
        isTest: true,
      },
    });

    await recordAudit({
      workspaceId: campaign.workspaceId,
      actorUserId: user.id,
      action: "event.test_received",
      entityType: "ConversionEvent",
      entityId: event.id,
      metadata: { campaignId: campaign.id, eventType: input.eventType, isTest: true },
    });

    return json({ event, isTest: true }, 201);
  });
}

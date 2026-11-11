import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { z } from "zod";
import { ingestConversionEvent } from "@/lib/events";
import { recordAudit } from "@/lib/audit";

const ingestSchema = z.object({
  campaignId: z.string().min(1, "campaignId is required."),
  externalEventId: z.string().trim().min(1).max(200),
  eventType: z.enum([
    "REGISTRATION",
    "LEAD",
    "PURCHASE",
    "SUBSCRIPTION",
    "APPLICATION",
    "OTHER",
  ]),
  occurredAt: z.iso.datetime({ offset: true }),
  valueNaira: z.string().trim().nullish(),
  trackingToken: z.string().trim().min(8).max(200).nullish(),
  isTest: z.boolean().default(false),
  source: z.enum(["API", "IMPORT", "MANUAL", "PROMO_CODE"]).default("API"),
});

export async function POST(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const input = ingestSchema.parse(await readJson(request));

    const campaign = await db.campaign.findUnique({
      where: { id: input.campaignId },
      select: { id: true, workspaceId: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }
    const context = await requireWorkspace(user, campaign.workspaceId);

    const result = await ingestConversionEvent(campaign.id, {
      externalEventId: input.externalEventId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      valueNaira: input.valueNaira,
      trackingToken: input.trackingToken,
      isTest: input.isTest,
      source: input.source,
    });

    if (result.duplicate) {
      return json({ event: result.event, duplicate: true });
    }

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "event.ingested",
      entityType: "ConversionEvent",
      entityId: result.event.id,
      metadata: {
        campaignId: campaign.id,
        source: input.source,
        isTest: input.isTest,
        eventType: input.eventType,
      },
    });

    return json(
      { event: result.event, attribution: result.attribution, duplicate: false },
      201,
    );
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { minorToNairaString } from "@/lib/money";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/report.csv">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        workspace: { include: { memberships: { where: { userId: user.id } } } },
        currentTermVersion: { include: { rewardRules: true } },
      },
    });
    if (!campaign || campaign.workspace.memberships.length === 0) {
      throw notFound("Campaign not found.");
    }
    await requireWorkspace(user, campaign.workspaceId);

    const [participants, clicks, events, rewards] = await Promise.all([
      db.campaignParticipant.findMany({
        where: { campaignId },
        include: { creatorProfile: { include: { user: { select: { email: true } } } } },
      }),
      db.clickEvent.groupBy({
        by: ["participantId", "isEligible"],
        where: { campaignId },
        _count: true,
      }),
      db.conversionEvent.findMany({
        where: { campaignId, isTest: false },
        select: {
          id: true,
          eventType: true,
          occurredAt: true,
          source: true,
          verificationStatus: true,
          eligibilityStatus: true,
          participantId: true,
        },
      }),
      db.rewardCalculation.findMany({
        where: { campaignId },
        orderBy: [{ participantId: "asc" }, { version: "desc" }],
      }),
    ]);

    const latestReward = new Map<string, (typeof rewards)[number]>();
    for (const r of rewards) {
      if (!latestReward.has(r.participantId)) latestReward.set(r.participantId, r);
    }

    const clickMap = new Map<string, { total: number; eligible: number }>();
    for (const c of clicks) {
      const entry = clickMap.get(c.participantId) ?? { total: 0, eligible: 0 };
      entry.total += c._count;
      if (c.isEligible) entry.eligible += c._count;
      clickMap.set(c.participantId, entry);
    }

    const eventMap = new Map<string, number>();
    for (const e of events) {
      if (e.participantId && e.eligibilityStatus === "ELIGIBLE") {
        eventMap.set(e.participantId, (eventMap.get(e.participantId) ?? 0) + 1);
      }
    }

    const headers = [
      "Creator",
      "Email",
      "Status",
      "Terms version",
      "Accepted at",
      "Clicks (total)",
      "Clicks (eligible)",
      "Events (eligible)",
      "Latest reward version",
      "Latest reward status",
      "Latest reward total (NGN)",
    ];

    const rows = participants.map((p) => {
      const clicks = clickMap.get(p.id) ?? { total: 0, eligible: 0 };
      const reward = latestReward.get(p.id);
      return [
        p.creatorProfile.displayName,
        p.creatorProfile.user.email,
        p.status,
        p.acceptedTermVersionId ? "accepted" : "",
        p.acceptedAt ? p.acceptedAt.toISOString() : "",
        clicks.total,
        clicks.eligible,
        eventMap.get(p.id) ?? 0,
        reward ? reward.version : "",
        reward ? reward.status : "",
        reward ? minorToNairaString(BigInt(reward.totalMinor.toString())) : "",
      ];
    });

    const csv = toCsv(headers, rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campaign-${campaignId}-report.csv"`,
      },
    });
  });
}

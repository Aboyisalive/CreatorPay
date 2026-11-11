import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { formatMinor } from "@/lib/format";
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
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/rewards.csv">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        workspace: { include: { memberships: { where: { userId: user.id } } } },
      },
    });
    if (!campaign || campaign.workspace.memberships.length === 0) {
      throw notFound("Campaign not found.");
    }
    await requireWorkspace(user, campaign.workspaceId);

    const rewards = await db.rewardCalculation.findMany({
      where: { campaignId },
      orderBy: [{ participantId: "asc" }, { version: "desc" }],
      include: {
        participant: {
          include: {
            creatorProfile: {
              include: { user: { select: { email: true } } },
            },
          },
        },
        lines: true,
      },
    });

    const headers = [
      "Reward ID",
      "Creator",
      "Email",
      "Version",
      "Status",
      "Total (NGN)",
      "Currency",
      "Calculated at",
      "Approved at",
      "Disputed at",
      "Line items",
    ];

    const rows = rewards.map((r) => [
      r.id,
      r.participant.creatorProfile.displayName,
      r.participant.creatorProfile.user.email,
      r.version,
      r.status,
      minorToNairaString(BigInt(r.totalMinor.toString())),
      r.currency,
      r.calculatedAt.toISOString(),
      r.approvedAt ? r.approvedAt.toISOString() : "",
      r.disputedAt ? r.disputedAt.toISOString() : "",
      r.lines.map((l) => `${l.description} (${formatMinor(l.amountMinor, r.currency)})`).join("; "),
    ]);

    const csv = toCsv(headers, rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campaign-${campaignId}-rewards.csv"`,
      },
    });
  });
}

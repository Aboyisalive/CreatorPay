import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isBotUserAgent } from "@/lib/attribution";
import { sha256 } from "@/lib/tokens";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function destinationWithUtm(input: {
  destinationUrl: string;
  campaignId: string;
  participantId: string;
}): URL {
  const url = new URL(input.destinationUrl);
  url.searchParams.set("utm_source", "creatorpay");
  url.searchParams.set("utm_medium", "creator");
  url.searchParams.set("utm_campaign", input.campaignId);
  url.searchParams.set("utm_content", input.participantId);
  return url;
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/r/[token]">,
) {
  const { token } = await ctx.params;

  const link = await db.trackingLink.findUnique({
    where: { token },
    include: {
      campaign: true,
      participant: true,
    },
  });

  if (!link) {
    return new NextResponse("This tracking link is not valid.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const destination = destinationWithUtm({
    destinationUrl: link.destinationUrl,
    campaignId: link.campaignId,
    participantId: link.participantId,
  });

  if (!link.active) {
    return NextResponse.redirect(destination, 302);
  }

  if (link.campaign.status !== "PUBLISHED") {
    return NextResponse.redirect(destination, 302);
  }

  const userAgent = request.headers.get("user-agent");
  const ip = clientIp(request);
  const ipHash = sha256(`${ip}:${process.env.AUTH_SECRET ?? "local"}`);
  const day = new Date().toISOString().slice(0, 10);
  const visitorKey = sha256(`${ipHash}:${userAgent ?? "unknown"}:${day}`);
  const bot = isBotUserAgent(userAgent);

  await db.clickEvent.create({
    data: {
      campaignId: link.campaignId,
      participantId: link.participantId,
      trackingLinkId: link.id,
      userAgent: userAgent?.slice(0, 500) ?? null,
      ipHash,
      visitorKey,
      isBot: bot,
      isEligible: !bot,
      invalidReason: bot ? "Automated user agent detected." : null,
    },
  });

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: destination.toString(),
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}

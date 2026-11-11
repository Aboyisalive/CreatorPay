import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { Prisma } from "@/generated/prisma/client";
import type { EventType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { buildTermsSnapshot } from "@/lib/campaigns";
import { sha256 } from "@/lib/tokens";

// Money is stored as NUMERIC(18, 0) holding integer kobo. Build it from an
// exact Decimal, never a binary float.
const kobo = (n: number) => new Prisma.Decimal(n);

const PASSWORD = "Password123!";
const BUSINESS_EMAIL = "owner@creatorpay.test";
const CREATOR_EMAIL = "creator@creatorpay.test";
const SECOND_CREATOR_EMAIL = "creator2@creatorpay.test";

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number, hour = 10): Date {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

type RuleSeed = {
  name: string;
  eventType: EventType;
  amountMinor: Prisma.Decimal;
  maxCount: number | null;
  capMinor: Prisma.Decimal | null;
};

async function createCampaign(input: {
  workspaceId: string;
  createdById: string;
  name: string;
  summary: string;
  description: string;
  objectives: (
    | "AWARENESS"
    | "TRAFFIC"
    | "LEADS"
    | "REGISTRATIONS"
    | "PURCHASES"
    | "OTHER"
  )[];
  status: "DRAFT" | "PUBLISHED";
  destinationUrl: string;
  startAt: Date;
  endAt: Date;
  attributionWindowDays: number;
  budgetMinor: Prisma.Decimal;
  rules: RuleSeed[];
}) {
  const campaign = await db.campaign.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      summary: input.summary,
      description: input.description,
      objectives: input.objectives,
      status: input.status,
      participationMode: "INVITE_ONLY",
      attributionModel: "LAST_ELIGIBLE_CLICK",
      attributionWindowDays: input.attributionWindowDays,
      destinationUrl: input.destinationUrl,
      startAt: input.startAt,
      endAt: input.endAt,
      budgetMinor: input.budgetMinor,
      currency: "NGN",
    },
  });

  const version = await db.campaignTermVersion.create({
    data: {
      campaignId: campaign.id,
      version: 1,
      createdById: input.createdById,
      snapshot: {},
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
    },
  });

  const rules = [];
  for (const rule of input.rules) {
    rules.push(
      await db.rewardRule.create({
        data: {
          termVersionId: version.id,
          type: "PER_EVENT",
          name: rule.name,
          eventType: rule.eventType,
          amountMinor: rule.amountMinor,
          maxCount: rule.maxCount,
          capMinor: rule.capMinor,
        },
      }),
    );
  }

  const snapshot = buildTermsSnapshot(campaign, rules);
  await db.campaignTermVersion.update({
    where: { id: version.id },
    data: { snapshot },
  });
  await db.campaign.update({
    where: { id: campaign.id },
    data: { currentTermVersionId: version.id },
  });

  return { campaign, version, rules };
}

async function main() {
  console.log("Seeding CreatorPay demo data…");

  const passwordHash = await hash(PASSWORD);

  const owner = await db.user.upsert({
    where: { email: BUSINESS_EMAIL },
    update: { name: "Tola Adeyemi", passwordHash },
    create: {
      email: BUSINESS_EMAIL,
      name: "Tola Adeyemi",
      passwordHash,
    },
  });

  const creator = await db.user.upsert({
    where: { email: CREATOR_EMAIL },
    update: { name: "Amara Okafor", passwordHash },
    create: {
      email: CREATOR_EMAIL,
      name: "Amara Okafor",
      passwordHash,
    },
  });

  const secondCreator = await db.user.upsert({
    where: { email: SECOND_CREATOR_EMAIL },
    update: { name: "Kemi Balogun", passwordHash },
    create: {
      email: SECOND_CREATOR_EMAIL,
      name: "Kemi Balogun",
      passwordHash,
    },
  });

  const creatorProfile = await db.creatorProfile.upsert({
    where: { userId: creator.id },
    update: {
      displayName: "Amara Okafor",
      bio: "Lifestyle and skincare creator based in Lagos.",
      socials: {
        instagram: "@amara.glow",
        tiktok: "@amaraglow",
        followers: 48000,
        selfReported: true,
      },
    },
    create: {
      userId: creator.id,
      displayName: "Amara Okafor",
      bio: "Lifestyle and skincare creator based in Lagos.",
      socials: {
        instagram: "@amara.glow",
        tiktok: "@amaraglow",
        followers: 48000,
        selfReported: true,
      },
    },
  });

  const secondCreatorProfile = await db.creatorProfile.upsert({
    where: { userId: secondCreator.id },
    update: { displayName: "Kemi Balogun" },
    create: { userId: secondCreator.id, displayName: "Kemi Balogun" },
  });

  const workspace = await db.workspace.upsert({
    where: { slug: "lagos-beauty-co" },
    update: { name: "Lagos Beauty Co." },
    create: {
      name: "Lagos Beauty Co.",
      slug: "lagos-beauty-co",
      type: "BUSINESS",
      currency: "NGN",
    },
  });

  await db.membership.upsert({
    where: {
      userId_workspaceId: { userId: owner.id, workspaceId: workspace.id },
    },
    update: { role: "OWNER" },
    create: { userId: owner.id, workspaceId: workspace.id, role: "OWNER" },
  });

  // Make the seed repeatable without deleting unrelated workspaces.
  await db.campaign.deleteMany({
    where: {
      workspaceId: workspace.id,
      name: {
        in: [
          "December Glow Launch",
          "Always-On Lead Capture",
          "January Creator Test",
        ],
      },
    },
  });

  const glow = await createCampaign({
    workspaceId: workspace.id,
    createdById: owner.id,
    name: "December Glow Launch",
    summary:
      "Drive registrations and first purchases for the December skincare bundle.",
    description:
      "Creators share their glow routine using the tracked link. Registration and first-purchase events are verified by the business.",
    objectives: ["REGISTRATIONS", "PURCHASES"],
    status: "PUBLISHED",
    destinationUrl: "https://example.com/december-glow",
    startAt: daysFromNow(-10),
    endAt: daysFromNow(20),
    attributionWindowDays: 7,
    budgetMinor: kobo(50_000_000), // ₦500,000
    rules: [
      {
        name: "Verified registration",
        eventType: "REGISTRATION",
        amountMinor: kobo(75_000), // ₦750
        maxCount: 200,
        capMinor: kobo(15_000_000), // ₦150,000
      },
      {
        name: "First purchase",
        eventType: "PURCHASE",
        amountMinor: kobo(250_000), // ₦2,500
        maxCount: 50,
        capMinor: kobo(12_500_000), // ₦125,000
      },
    ],
  });

  const participant = await db.campaignParticipant.create({
    data: {
      campaignId: glow.campaign.id,
      creatorProfileId: creatorProfile.id,
      status: "ACTIVE",
      acceptedTermVersionId: glow.version.id,
      acceptedAt: daysFromNow(-8),
    },
  });

  const link = await db.trackingLink.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: participant.id,
      token: "demo-amara-glow",
      destinationUrl: glow.campaign.destinationUrl,
      createdAt: daysFromNow(-8),
    },
  });

  // Deliverable requirements for the campaign
  const deliverable1 = await db.deliverableRequirement.create({
    data: {
      campaignId: glow.campaign.id,
      name: "Instagram launch post",
      type: "CONTENT_POST",
      description: "Feed post showcasing the December glow bundle with campaign tracking link in bio.",
      quantity: 1,
      evidenceType: "URL",
      dueAt: daysFromNow(5),
    },
  });

  const deliverable2 = await db.deliverableRequirement.create({
    data: {
      campaignId: glow.campaign.id,
      name: "Instagram story series",
      type: "CONTENT_STORY",
      description: "3-story series driving to the campaign destination link.",
      quantity: 3,
      evidenceType: "URL",
      dueAt: daysFromNow(10),
    },
  });

  // Creator submission (approved)
  await db.submission.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: participant.id,
      deliverableId: deliverable1.id,
      evidenceUrl: "https://instagram.com/p/demo-glow-post",
      note: "Posted with the tracked link in bio.",
      status: "APPROVED",
      reviewerId: owner.id,
      reviewNote: null,
      submittedAt: daysFromNow(-5),
      reviewedAt: daysFromNow(-4),
    },
  });

  // Creator submission (pending review)
  await db.submission.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: participant.id,
      deliverableId: deliverable2.id,
      evidenceUrl: "https://instagram.com/stories/amara.glow/demo",
      note: "Story series is live, expires in 24 hours.",
      status: "SUBMITTED",
      submittedAt: daysFromNow(-1),
    },
  });

  const registrationEvents: string[] = [];
  const rewardLines: {
    ruleId: string;
    eventId: string;
    amountMinor: Prisma.Decimal;
    description: string;
  }[] = [];

  for (let index = 0; index < 4; index += 1) {
    const clickAt = daysFromNow(-6 + index, 9);
    const eventAt = new Date(clickAt.getTime() + 2 * 60 * 60 * 1000);

    await db.clickEvent.create({
      data: {
        campaignId: glow.campaign.id,
        participantId: participant.id,
        trackingLinkId: link.id,
        occurredAt: clickAt,
        visitorKey: sha256(`seed-reg-visitor-${index}`),
        ipHash: sha256(`seed-ip-${index}`),
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
        isEligible: true,
      },
    });

    const event = await db.conversionEvent.create({
      data: {
        campaignId: glow.campaign.id,
        participantId: participant.id,
        trackingLinkId: link.id,
        externalEventId: `seed-registration-${index + 1}`,
        eventType: "REGISTRATION",
        valueMinor: null,
        currency: "NGN",
        occurredAt: eventAt,
        source: "API",
        verificationStatus: "VERIFIED",
        eligibilityStatus: "ELIGIBLE",
      },
    });

    registrationEvents.push(event.id);
    rewardLines.push({
      ruleId: glow.rules[0]!.id,
      eventId: event.id,
      amountMinor: kobo(75_000),
      description: "Verified registration — eligible registration",
    });
  }

  const purchaseClickAt = daysFromNow(-1, 14);
  await db.clickEvent.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: participant.id,
      trackingLinkId: link.id,
      occurredAt: purchaseClickAt,
      visitorKey: sha256("seed-purchase-visitor"),
      ipHash: sha256("seed-purchase-ip"),
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0",
      isEligible: true,
    },
  });

  const purchaseEvent = await db.conversionEvent.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: participant.id,
      trackingLinkId: link.id,
      externalEventId: "seed-purchase-1",
      eventType: "PURCHASE",
      valueMinor: kobo(2_500_000), // ₦25,000 order value
      currency: "NGN",
      occurredAt: new Date(purchaseClickAt.getTime() + 60 * 60 * 1000),
      source: "API",
      verificationStatus: "VERIFIED",
      eligibilityStatus: "ELIGIBLE",
    },
  });

  rewardLines.push({
    ruleId: glow.rules[1]!.id,
    eventId: purchaseEvent.id,
    amountMinor: kobo(250_000),
    description: "First purchase — eligible purchase",
  });

  // Extra click with no conversion, plus filtered automated traffic.
  await db.clickEvent.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: participant.id,
      trackingLinkId: link.id,
      occurredAt: daysFromNow(-4, 18),
      visitorKey: sha256("seed-extra-visitor"),
      ipHash: sha256("seed-extra-ip"),
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      isEligible: true,
    },
  });

  for (let index = 0; index < 2; index += 1) {
    await db.clickEvent.create({
      data: {
        campaignId: glow.campaign.id,
        participantId: participant.id,
        trackingLinkId: link.id,
        occurredAt: daysFromNow(-3, 11 + index),
        visitorKey: sha256(`seed-bot-${index}`),
        ipHash: sha256(`seed-bot-ip-${index}`),
        userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)",
        isBot: true,
        isEligible: false,
        invalidReason: "Automated user agent detected.",
      },
    });
  }

  await db.conversionEvent.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: null,
      externalEventId: "seed-unattributed-1",
      eventType: "LEAD",
      occurredAt: daysFromNow(-2),
      source: "IMPORT",
      verificationStatus: "PENDING",
      eligibilityStatus: "UNDER_REVIEW",
      reviewReason:
        "Imported event has no creator tracking token, so it remains unattributed.",
    },
  });

  await db.conversionEvent.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: participant.id,
      trackingLinkId: link.id,
      externalEventId: "seed-late-registration-1",
      eventType: "REGISTRATION",
      occurredAt: daysFromNow(-14),
      source: "MANUAL",
      verificationStatus: "VERIFIED",
      eligibilityStatus: "INELIGIBLE",
      reviewReason:
        "No eligible creator click was recorded inside the attribution window.",
    },
  });

  // A versioned, approved reward. Approval is not payment.
  const totalMinor = rewardLines.reduce(
    (total, line) => total.plus(line.amountMinor),
    kobo(0),
  );

  const reward = await db.rewardCalculation.create({
    data: {
      campaignId: glow.campaign.id,
      participantId: participant.id,
      termVersionId: glow.version.id,
      version: 1,
      status: "APPROVED",
      currency: "NGN",
      totalMinor,
      approvedAt: daysFromNow(-1),
      approvedById: owner.id,
      breakdown: {
        formula: "per-eligible-event",
        attributionModel: "LAST_ELIGIBLE_CLICK",
        attributionWindowDays: 7,
        termVersion: 1,
        countedEventIds: [...registrationEvents, purchaseEvent.id],
        rules: [
          {
            id: glow.rules[0]!.id,
            name: glow.rules[0]!.name,
            eventType: "REGISTRATION",
            unitAmountMinor: "75000",
          },
          {
            id: glow.rules[1]!.id,
            name: glow.rules[1]!.name,
            eventType: "PURCHASE",
            unitAmountMinor: "250000",
          },
        ],
        budget: {
          budgetMinor: "50000000",
          unlimited: false,
          remainingBeforeMinor: "50000000",
        },
        calculatedAt: daysFromNow(-1).toISOString(),
      },
      lines: {
        create: rewardLines.map((line) => ({
          rewardRuleId: line.ruleId,
          conversionEventId: line.eventId,
          type: "PER_EVENT",
          description: line.description,
          quantity: 1,
          unitAmountMinor: line.amountMinor,
          amountMinor: line.amountMinor,
        })),
      },
    },
  });

  const leadCampaign = await createCampaign({
    workspaceId: workspace.id,
    createdById: owner.id,
    name: "Always-On Lead Capture",
    summary:
      "A rolling lead-generation campaign for the skincare consultation funnel.",
    description:
      "Invite-only. Creators are rewarded for verified consultation leads attributed within 14 days.",
    objectives: ["LEADS"],
    status: "PUBLISHED",
    destinationUrl: "https://example.com/consultation",
    startAt: daysFromNow(-3),
    endAt: daysFromNow(60),
    attributionWindowDays: 14,
    budgetMinor: kobo(20_000_000), // ₦200,000
    rules: [
      {
        name: "Verified consultation lead",
        eventType: "LEAD",
        amountMinor: kobo(40_000), // ₦400
        maxCount: 100,
        capMinor: kobo(20_000_000),
      },
    ],
  });

  await db.campaignInvitation.create({
    data: {
      campaignId: leadCampaign.campaign.id,
      email: SECOND_CREATOR_EMAIL,
      // Only the hash is stored; the demo link /invite/demo-invite-lead still
      // resolves because we hash the known plaintext token below.
      tokenHash: sha256("demo-invite-lead"),
      invitedById: owner.id,
      creatorProfileId: secondCreatorProfile.id,
      expiresAt: daysFromNow(60),
    },
  });

  await createCampaign({
    workspaceId: workspace.id,
    createdById: owner.id,
    name: "January Creator Test",
    summary: "Draft campaign used to test the campaign builder.",
    description: "Not published yet.",
    objectives: ["REGISTRATIONS"],
    status: "DRAFT",
    destinationUrl: "https://example.com/january",
    startAt: daysFromNow(30),
    endAt: daysFromNow(60),
    attributionWindowDays: 7,
    budgetMinor: kobo(10_000_000),
    rules: [
      {
        name: "Verified registration",
        eventType: "REGISTRATION",
        amountMinor: kobo(50_000),
        maxCount: null,
        capMinor: null,
      },
    ],
  });

  await db.auditEvent.createMany({
    data: [
      {
        workspaceId: workspace.id,
        actorUserId: owner.id,
        action: "workspace.created",
        entityType: "Workspace",
        entityId: workspace.id,
        metadata: { seeded: true },
      },
      {
        workspaceId: workspace.id,
        actorUserId: owner.id,
        action: "campaign.published",
        entityType: "Campaign",
        entityId: glow.campaign.id,
        metadata: { termVersion: 1 },
      },
      {
        workspaceId: workspace.id,
        actorUserId: owner.id,
        action: "reward.approved",
        entityType: "RewardCalculation",
        entityId: reward.id,
        metadata: { totalMinor: totalMinor.toString() },
      },
      {
        workspaceId: workspace.id,
        actorUserId: owner.id,
        action: "invitation.sent",
        entityType: "CampaignInvitation",
        entityId: `seed-invite-${leadCampaign.campaign.id}`,
        metadata: { email: SECOND_CREATOR_EMAIL },
      },
    ],
  });

  console.log("");
  console.log("CreatorPay seed complete.");
  console.log("---------------------------------------------");
  console.log(`Business owner : ${BUSINESS_EMAIL} / ${PASSWORD}`);
  console.log(`Creator        : ${CREATOR_EMAIL} / ${PASSWORD}`);
  console.log(`Second creator : ${SECOND_CREATOR_EMAIL} / ${PASSWORD}`);
  console.log("");
  console.log("Business view  : /dashboard");
  console.log("Creator view   : /creator");
  console.log("Demo invite    : /invite/demo-invite-lead");
  console.log("Demo track link: /r/demo-amara-glow");
  console.log("---------------------------------------------");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

/**
 * API integration and permission regression tests.
 *
 * These call route handlers directly against the local dev database with a
 * mocked session cookie, covering the guarantees the roadmap requires:
 * 401 unauthenticated, 403 cross-tenant and role denial, event idempotency,
 * test-event exclusion, and notification ownership.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "cp_session" && session.token
        ? { name, value: session.token }
        : undefined,
    set: () => {},
  }),
}));

import { db } from "@/lib/db";
import { signSessionToken } from "@/lib/auth";
import { toMinor } from "@/lib/money-server";
import { GET as getCampaign } from "@/app/api/v1/campaigns/[campaignId]/route";
import { POST as ingestEvent } from "@/app/api/v1/events/route";
import { POST as readNotification } from "@/app/api/v1/notifications/[notificationId]/read/route";
import { POST as approveReward } from "@/app/api/v1/rewards/[rewardId]/approve/route";
import { POST as validateCampaign } from "@/app/api/v1/campaigns/[campaignId]/validate/route";

const stamp = Date.now();

const ownerAEmail = `it-owner-a-${stamp}@creatorpay.test`;
const managerAEmail = `it-manager-a-${stamp}@creatorpay.test`;
const ownerBEmail = `it-owner-b-${stamp}@creatorpay.test`;
const creatorEmail = `it-creator-${stamp}@creatorpay.test`;

let ownerAId: string;
let managerAId: string;
let ownerBId: string;
let creatorId: string;
let workspaceAId: string;
let workspaceBId: string;
let campaignAId: string;
let rewardId: string;
let notificationId: string;

async function actingAs(userId: string | null): Promise<void> {
  session.token = userId ? await signSessionToken(userId) : null;
}

function ctx<T extends object>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

beforeAll(async () => {
  const [ownerA, managerA, ownerB, creator] = await Promise.all([
    db.user.create({
      data: { email: ownerAEmail, passwordHash: "x", name: "Owner A" },
    }),
    db.user.create({
      data: { email: managerAEmail, passwordHash: "x", name: "Manager A" },
    }),
    db.user.create({
      data: { email: ownerBEmail, passwordHash: "x", name: "Owner B" },
    }),
    db.user.create({
      data: { email: creatorEmail, passwordHash: "x", name: "It Creator" },
    }),
  ]);
  ownerAId = ownerA.id;
  managerAId = managerA.id;
  ownerBId = ownerB.id;
  creatorId = creator.id;

  const workspaceA = await db.workspace.create({
    data: {
      name: `It Workspace A ${stamp}`,
      slug: `it-workspace-a-${stamp}`,
      memberships: {
        create: [
          { userId: ownerAId, role: "OWNER" },
          { userId: managerAId, role: "CAMPAIGN_MANAGER" },
        ],
      },
    },
  });
  workspaceAId = workspaceA.id;

  const workspaceB = await db.workspace.create({
    data: {
      name: `It Workspace B ${stamp}`,
      slug: `it-workspace-b-${stamp}`,
      memberships: { create: { userId: ownerBId, role: "OWNER" } },
    },
  });
  workspaceBId = workspaceB.id;

  const campaignA = await db.campaign.create({
    data: {
      workspaceId: workspaceAId,
      name: `Integration campaign ${stamp}`,
      objectives: ["AWARENESS"],
      status: "PUBLISHED",
      destinationUrl: "https://example.com/landing",
      currency: "NGN",
    },
  });
  campaignAId = campaignA.id;

  const creatorProfile = await db.creatorProfile.create({
    data: { userId: creatorId, displayName: "It Creator" },
  });
  const termVersion = await db.campaignTermVersion.create({
    data: {
      campaignId: campaignAId,
      version: 1,
      snapshot: { objectives: ["AWARENESS"], policies: {} },
      publishedAt: new Date(),
    },
  });
  const participant = await db.campaignParticipant.create({
    data: {
      campaignId: campaignAId,
      creatorProfileId: creatorProfile.id,
      status: "ACTIVE",
      acceptedTermVersionId: termVersion.id,
      acceptedAt: new Date(),
    },
  });

  const reward = await db.rewardCalculation.create({
    data: {
      campaignId: campaignAId,
      participantId: participant.id,
      termVersionId: termVersion.id,
      version: 1,
      status: "CALCULATED",
      currency: "NGN",
      totalMinor: toMinor(100_000),
      breakdown: {},
    },
  });
  rewardId = reward.id;

  const notification = await db.notification.create({
    data: {
      userId: ownerAId,
      workspaceId: workspaceAId,
      type: "it.test",
      title: "Integration notification",
    },
  });
  notificationId = notification.id;
});

afterAll(async () => {
  await db.notification.deleteMany({
    where: { userId: { in: [ownerAId, managerAId, ownerBId] } },
  });
  await db.rewardCalculation.deleteMany({ where: { campaignId: campaignAId } });
  await db.conversionEvent.deleteMany({ where: { campaignId: campaignAId } });
  await db.campaign.deleteMany({ where: { workspaceId: workspaceAId } });
  await db.workspace.deleteMany({
    where: { id: { in: [workspaceAId, workspaceBId] } },
  });
  await db.user.deleteMany({
    where: { id: { in: [ownerAId, managerAId, ownerBId, creatorId] } },
  });
});

describe("authentication", () => {
  it("returns 401 without a session", async () => {
    await actingAs(null);
    const response = await getCampaign(
      new Request("http://test"),
      ctx({ campaignId: campaignAId }),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("unauthorized");
    expect(body.error.request_id).toBeTruthy();
  });

  it("returns 401 for a forged/invalid token", async () => {
    session.token = "not-a-real-token";
    const response = await getCampaign(
      new Request("http://test"),
      ctx({ campaignId: campaignAId }),
    );
    expect(response.status).toBe(401);
  });
});

describe("tenant isolation", () => {
  it("allows the workspace owner to read their campaign", async () => {
    await actingAs(ownerAId);
    const response = await getCampaign(
      new Request("http://test"),
      ctx({ campaignId: campaignAId }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.campaign.id).toBe(campaignAId);
  });

  it("denies a member of another workspace (403, no data leak)", async () => {
    await actingAs(ownerBId);
    const response = await getCampaign(
      new Request("http://test"),
      ctx({ campaignId: campaignAId }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("forbidden");
    expect(JSON.stringify(body)).not.toContain("Integration campaign");
  });

  it("denies cross-tenant event ingestion", async () => {
    await actingAs(ownerBId);
    const response = await ingestEvent(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          campaignId: campaignAId,
          externalEventId: `it-cross-tenant-${stamp}`,
          eventType: "LEAD",
          occurredAt: new Date().toISOString(),
        }),
      }),
    );
    expect(response.status).toBe(403);
    const stored = await db.conversionEvent.findFirst({
      where: { externalEventId: `it-cross-tenant-${stamp}` },
    });
    expect(stored).toBeNull();
  });
});

describe("role regression", () => {
  it("CAMPAIGN_MANAGER can validate but not approve rewards", async () => {
    await actingAs(managerAId);

    const validation = await validateCampaign(
      new Request("http://test"),
      ctx({ campaignId: campaignAId }),
    );
    expect(validation.status).toBe(200);

    const approval = await approveReward(
      new Request("http://test"),
      ctx({ rewardId }),
    );
    expect(approval.status).toBe(403);
    const body = await approval.json();
    expect(body.error.code).toBe("forbidden");

    const reward = await db.rewardCalculation.findUnique({
      where: { id: rewardId },
    });
    expect(reward?.status).toBe("CALCULATED");
    expect(reward?.approvedAt).toBeNull();
  });
});

describe("event ingestion", () => {
  it("is idempotent on (campaignId, externalEventId)", async () => {
    await actingAs(ownerAId);
    const externalEventId = `it-idem-${stamp}`;
    const payload = {
      campaignId: campaignAId,
      externalEventId,
      eventType: "LEAD",
      occurredAt: new Date().toISOString(),
    };

    const first = await ingestEvent(
      new Request("http://test", { method: "POST", body: JSON.stringify(payload) }),
    );
    expect(first.status).toBe(201);
    expect((await first.json()).duplicate).toBe(false);

    const second = await ingestEvent(
      new Request("http://test", { method: "POST", body: JSON.stringify(payload) }),
    );
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);

    const count = await db.conversionEvent.count({
      where: { campaignId: campaignAId, externalEventId },
    });
    expect(count).toBe(1);
  });

  it("marks test events ineligible for rewards", async () => {
    await actingAs(ownerAId);
    const response = await ingestEvent(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          campaignId: campaignAId,
          externalEventId: `it-test-${stamp}`,
          eventType: "PURCHASE",
          occurredAt: new Date().toISOString(),
          isTest: true,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.event.eligibilityStatus).toBe("INELIGIBLE");
    expect(body.event.isTest).toBe(true);
  });

  it("rejects malformed payloads with a validation error", async () => {
    await actingAs(ownerAId);
    const response = await ingestEvent(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ campaignId: campaignAId, eventType: "LEAD" }),
      }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
    expect(Array.isArray(body.error.details)).toBe(true);
  });
});

describe("notification ownership", () => {
  it("returns 403 when reading someone else's notification", async () => {
    await actingAs(ownerBId);
    const response = await readNotification(
      new Request("http://test"),
      ctx({ notificationId }),
    );
    expect(response.status).toBe(403);
    const stored = await db.notification.findUnique({
      where: { id: notificationId },
    });
    expect(stored?.readAt).toBeNull();
  });

  it("lets the owner mark their notification read", async () => {
    await actingAs(ownerAId);
    const response = await readNotification(
      new Request("http://test"),
      ctx({ notificationId }),
    );
    expect(response.status).toBe(200);
    const stored = await db.notification.findUnique({
      where: { id: notificationId },
    });
    expect(stored?.readAt).not.toBeNull();
  });
});

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('BUSINESS', 'AGENCY');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'CAMPAIGN_MANAGER', 'REVIEWER', 'FINANCE', 'ANALYST');

-- CreateEnum
CREATE TYPE "CampaignObjective" AS ENUM ('AWARENESS', 'TRAFFIC', 'LEADS', 'REGISTRATIONS', 'PURCHASES', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParticipationMode" AS ENUM ('INVITE_ONLY', 'APPLICATION', 'BOTH');

-- CreateEnum
CREATE TYPE "AttributionModel" AS ENUM ('LAST_ELIGIBLE_CLICK');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'REMOVED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RewardRuleType" AS ENUM ('FIXED_DELIVERABLE', 'PER_EVENT', 'TIERED_BONUS');

-- CreateEnum
CREATE TYPE "DeliverableType" AS ENUM ('CONTENT_POST', 'CONTENT_STORY', 'CONTENT_REEL', 'CONTENT_VIDEO', 'CONTENT_BLOG', 'CONTENT_LIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliverableEvidenceType" AS ENUM ('URL', 'FILE', 'TEXT', 'SOCIAL_HANDLE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('REGISTRATION', 'LEAD', 'PURCHASE', 'SUBSCRIPTION', 'APPLICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('API', 'IMPORT', 'MANUAL', 'PROMO_CODE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'INELIGIBLE', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('CALCULATED', 'PENDING_REVIEW', 'APPROVED', 'PAYABLE', 'PAYMENT_INITIATED', 'PAID', 'PAYMENT_FAILED', 'DISPUTED', 'ADJUSTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL DEFAULT 'BUSINESS',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CAMPAIGN_MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "phone" TEXT,
    "socials" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "objectives" "CampaignObjective"[],
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "participationMode" "ParticipationMode" NOT NULL DEFAULT 'INVITE_ONLY',
    "attributionModel" "AttributionModel" NOT NULL DEFAULT 'LAST_ELIGIBLE_CLICK',
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 7,
    "destinationUrl" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "budgetMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "currentTermVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTermVersion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignTermVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL,
    "termVersionId" TEXT NOT NULL,
    "type" "RewardRuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" "EventType",
    "amountMinor" BIGINT NOT NULL,
    "maxCount" INTEGER,
    "capMinor" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignInvitation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "creatorProfileId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignParticipant" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "acceptedTermVersionId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverableRequirement" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeliverableType" NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "evidenceType" "DeliverableEvidenceType" NOT NULL DEFAULT 'URL',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverableRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "evidenceFileKey" TEXT,
    "evidenceText" TEXT,
    "note" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "trackingLinkId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitorKey" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "invalidReason" TEXT,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "participantId" TEXT,
    "trackingLinkId" TEXT,
    "externalEventId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "valueMinor" BIGINT,
    "currency" TEXT DEFAULT 'NGN',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "EventSource" NOT NULL DEFAULT 'MANUAL',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "eligibilityStatus" "EligibilityStatus" NOT NULL DEFAULT 'PENDING',
    "reviewReason" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCalculation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "termVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RewardStatus" NOT NULL DEFAULT 'CALCULATED',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "disputedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "rewardCalculationId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLine" (
    "id" TEXT NOT NULL,
    "rewardCalculationId" TEXT NOT NULL,
    "rewardRuleId" TEXT,
    "conversionEventId" TEXT,
    "type" "RewardRuleType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmountMinor" BIGINT NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "RewardLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_userId_key" ON "CreatorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_currentTermVersionId_key" ON "Campaign"("currentTermVersionId");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_status_idx" ON "Campaign"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_createdAt_idx" ON "Campaign"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignTermVersion_campaignId_idx" ON "CampaignTermVersion"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTermVersion_campaignId_version_key" ON "CampaignTermVersion"("campaignId", "version");

-- CreateIndex
CREATE INDEX "RewardRule_termVersionId_idx" ON "RewardRule"("termVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignInvitation_token_key" ON "CampaignInvitation"("token");

-- CreateIndex
CREATE INDEX "CampaignInvitation_campaignId_status_idx" ON "CampaignInvitation"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignInvitation_campaignId_email_key" ON "CampaignInvitation"("campaignId", "email");

-- CreateIndex
CREATE INDEX "CampaignParticipant_campaignId_status_idx" ON "CampaignParticipant"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignParticipant_creatorProfileId_idx" ON "CampaignParticipant"("creatorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignParticipant_campaignId_creatorProfileId_key" ON "CampaignParticipant"("campaignId", "creatorProfileId");

-- CreateIndex
CREATE INDEX "DeliverableRequirement_campaignId_idx" ON "DeliverableRequirement"("campaignId");

-- CreateIndex
CREATE INDEX "Submission_campaignId_status_idx" ON "Submission"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Submission_participantId_idx" ON "Submission"("participantId");

-- CreateIndex
CREATE INDEX "Submission_deliverableId_idx" ON "Submission"("deliverableId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLink_token_key" ON "TrackingLink"("token");

-- CreateIndex
CREATE INDEX "TrackingLink_campaignId_idx" ON "TrackingLink"("campaignId");

-- CreateIndex
CREATE INDEX "TrackingLink_participantId_idx" ON "TrackingLink"("participantId");

-- CreateIndex
CREATE INDEX "ClickEvent_campaignId_occurredAt_idx" ON "ClickEvent"("campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClickEvent_participantId_occurredAt_idx" ON "ClickEvent"("participantId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClickEvent_trackingLinkId_idx" ON "ClickEvent"("trackingLinkId");

-- CreateIndex
CREATE INDEX "ConversionEvent_campaignId_eventType_eligibilityStatus_idx" ON "ConversionEvent"("campaignId", "eventType", "eligibilityStatus");

-- CreateIndex
CREATE INDEX "ConversionEvent_campaignId_occurredAt_idx" ON "ConversionEvent"("campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "ConversionEvent_participantId_idx" ON "ConversionEvent"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEvent_campaignId_externalEventId_key" ON "ConversionEvent"("campaignId", "externalEventId");

-- CreateIndex
CREATE INDEX "RewardCalculation_campaignId_status_idx" ON "RewardCalculation"("campaignId", "status");

-- CreateIndex
CREATE INDEX "RewardCalculation_participantId_calculatedAt_idx" ON "RewardCalculation"("participantId", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardCalculation_participantId_version_key" ON "RewardCalculation"("participantId", "version");

-- CreateIndex
CREATE INDEX "Settlement_rewardCalculationId_idx" ON "Settlement"("rewardCalculationId");

-- CreateIndex
CREATE INDEX "RewardLine_rewardCalculationId_idx" ON "RewardLine"("rewardCalculationId");

-- CreateIndex
CREATE INDEX "RewardLine_conversionEventId_idx" ON "RewardLine"("conversionEventId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_currentTermVersionId_fkey" FOREIGN KEY ("currentTermVersionId") REFERENCES "CampaignTermVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTermVersion" ADD CONSTRAINT "CampaignTermVersion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTermVersion" ADD CONSTRAINT "CampaignTermVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_termVersionId_fkey" FOREIGN KEY ("termVersionId") REFERENCES "CampaignTermVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInvitation" ADD CONSTRAINT "CampaignInvitation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInvitation" ADD CONSTRAINT "CampaignInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInvitation" ADD CONSTRAINT "CampaignInvitation_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignParticipant" ADD CONSTRAINT "CampaignParticipant_acceptedTermVersionId_fkey" FOREIGN KEY ("acceptedTermVersionId") REFERENCES "CampaignTermVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableRequirement" ADD CONSTRAINT "DeliverableRequirement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CampaignParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "DeliverableRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CampaignParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CampaignParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CampaignParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardCalculation" ADD CONSTRAINT "RewardCalculation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardCalculation" ADD CONSTRAINT "RewardCalculation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CampaignParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardCalculation" ADD CONSTRAINT "RewardCalculation_termVersionId_fkey" FOREIGN KEY ("termVersionId") REFERENCES "CampaignTermVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardCalculation" ADD CONSTRAINT "RewardCalculation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_rewardCalculationId_fkey" FOREIGN KEY ("rewardCalculationId") REFERENCES "RewardCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLine" ADD CONSTRAINT "RewardLine_rewardCalculationId_fkey" FOREIGN KEY ("rewardCalculationId") REFERENCES "RewardCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLine" ADD CONSTRAINT "RewardLine_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLine" ADD CONSTRAINT "RewardLine_conversionEventId_fkey" FOREIGN KEY ("conversionEventId") REFERENCES "ConversionEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


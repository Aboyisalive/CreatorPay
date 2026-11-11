-- MVP contract gaps: money to NUMERIC/Decimal, hashed invitation tokens,
-- workspace timezone, and the idempotency/attribution/adjustment/credential
-- tables. Generated from the live schema via `prisma migrate diff`, then
-- hand-extended with a data backfill for the token rename so the migration is
-- safe on populated databases.

-- DropIndex
DROP INDEX "CampaignInvitation_token_key";

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "budgetMinor" SET DEFAULT 0,
ALTER COLUMN "budgetMinor" SET DATA TYPE DECIMAL(18,0);

-- AlterTable (token -> tokenHash, with backfill so live invite links survive)
ALTER TABLE "CampaignInvitation" ADD COLUMN "tokenHash" TEXT;

-- Backfill: existing rows keep working because we hash their current token.
-- sha256() is built into PostgreSQL 11+; encode(...,'hex') matches the Node
-- runtime hashing in src/lib/tokens.ts exactly.
UPDATE "CampaignInvitation"
SET "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex')
WHERE "token" IS NOT NULL;

-- Drop the plaintext token column now that every row is hashed.
ALTER TABLE "CampaignInvitation" DROP COLUMN "token",
ALTER COLUMN "tokenHash" SET NOT NULL;

-- AlterTable
ALTER TABLE "ConversionEvent" ALTER COLUMN "valueMinor" SET DATA TYPE DECIMAL(18,0);

-- AlterTable
ALTER TABLE "RewardCalculation" ALTER COLUMN "totalMinor" SET DEFAULT 0,
ALTER COLUMN "totalMinor" SET DATA TYPE DECIMAL(18,0);

-- AlterTable
ALTER TABLE "RewardLine" ALTER COLUMN "unitAmountMinor" SET DATA TYPE DECIMAL(18,0),
ALTER COLUMN "amountMinor" SET DATA TYPE DECIMAL(18,0);

-- AlterTable
ALTER TABLE "RewardRule" ALTER COLUMN "amountMinor" SET DATA TYPE DECIMAL(18,0),
ALTER COLUMN "capMinor" SET DATA TYPE DECIMAL(18,0);

-- AlterTable
ALTER TABLE "Settlement" ALTER COLUMN "amountMinor" SET DATA TYPE DECIMAL(18,0);

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos';

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionRecord" (
    "id" TEXT NOT NULL,
    "conversionEventId" TEXT NOT NULL,
    "participantId" TEXT,
    "trackingLinkId" TEXT,
    "clickId" TEXT,
    "model" "AttributionModel" NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardAdjustment" (
    "id" TEXT NOT NULL,
    "rewardCalculationId" TEXT NOT NULL,
    "amountMinor" DECIMAL(18,0) NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['events:write']::TEXT[],
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_workspaceId_createdAt_idx" ON "IdempotencyKey"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_endpoint_key_userId_key" ON "IdempotencyKey"("endpoint", "key", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributionRecord_conversionEventId_key" ON "AttributionRecord"("conversionEventId");

-- CreateIndex
CREATE INDEX "AttributionRecord_participantId_idx" ON "AttributionRecord"("participantId");

-- CreateIndex
CREATE INDEX "AttributionRecord_clickId_idx" ON "AttributionRecord"("clickId");

-- CreateIndex
CREATE INDEX "RewardAdjustment_rewardCalculationId_idx" ON "RewardAdjustment"("rewardCalculationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_keyHash_key" ON "IntegrationCredential"("keyHash");

-- CreateIndex
CREATE INDEX "IntegrationCredential_workspaceId_idx" ON "IntegrationCredential"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignInvitation_tokenHash_key" ON "CampaignInvitation"("tokenHash");

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRecord" ADD CONSTRAINT "AttributionRecord_conversionEventId_fkey" FOREIGN KEY ("conversionEventId") REFERENCES "ConversionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRecord" ADD CONSTRAINT "AttributionRecord_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CampaignParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRecord" ADD CONSTRAINT "AttributionRecord_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRecord" ADD CONSTRAINT "AttributionRecord_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "ClickEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAdjustment" ADD CONSTRAINT "RewardAdjustment_rewardCalculationId_fkey" FOREIGN KEY ("rewardCalculationId") REFERENCES "RewardCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAdjustment" ADD CONSTRAINT "RewardAdjustment_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

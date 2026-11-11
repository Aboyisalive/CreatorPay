-- CreateEnum
CREATE TYPE "CampaignFundingStatus" AS ENUM ('UNFUNDED', 'AWAITING_FUNDS', 'FUNDED');

-- CreateEnum
CREATE TYPE "DepositState" AS ENUM ('RECEIVED', 'MATCHED', 'UNMATCHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DepositMatchedBy" AS ENUM ('REFERENCE', 'AMOUNT_SENDER', 'MANUAL', 'SIMULATED');

-- CreateEnum
CREATE TYPE "PayoutState" AS ENUM ('APPROVED', 'SUBMITTED', 'PENDING', 'SETTLED', 'FAILED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "fundingReference" TEXT,
ADD COLUMN     "fundingStatus" "CampaignFundingStatus" NOT NULL DEFAULT 'UNFUNDED';

-- CreateTable
CREATE TABLE "CreatorBankDetails" (
    "id" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "accountNameConfirmed" TEXT,
    "nubanOk" BOOLEAN NOT NULL DEFAULT false,
    "verifiedByBank" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorBankDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "bankReference" TEXT,
    "amountMinor" DECIMAL(18,0) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "senderHint" TEXT,
    "matchedBy" "DepositMatchedBy",
    "state" "DepositState" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "debitAccount" TEXT NOT NULL,
    "creditAccount" TEXT NOT NULL,
    "amountMinor" DECIMAL(18,0) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "rewardCalculationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "bankReference" TEXT,
    "amountMinor" DECIMAL(18,0) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "bankCode" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "narration" TEXT NOT NULL,
    "state" "PayoutState" NOT NULL DEFAULT 'APPROVED',
    "rawCode" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCall" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "responseCode" TEXT,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "rawBody" JSONB NOT NULL,
    "rawHeaders" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorBankDetails_creatorProfileId_key" ON "CreatorBankDetails"("creatorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_dedupeKey_key" ON "Deposit"("dedupeKey");

-- CreateIndex
CREATE INDEX "Deposit_state_createdAt_idx" ON "Deposit"("state", "createdAt");

-- CreateIndex
CREATE INDEX "Deposit_campaignId_idx" ON "Deposit"("campaignId");

-- CreateIndex
CREATE INDEX "Deposit_bankReference_idx" ON "Deposit"("bankReference");

-- CreateIndex
CREATE INDEX "JournalEntry_refType_refId_idx" ON "JournalEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "JournalEntry_debitAccount_idx" ON "JournalEntry"("debitAccount");

-- CreateIndex
CREATE INDEX "JournalEntry_creditAccount_idx" ON "JournalEntry"("creditAccount");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_requestId_key" ON "Payout"("requestId");

-- CreateIndex
CREATE INDEX "Payout_rewardCalculationId_idx" ON "Payout"("rewardCalculationId");

-- CreateIndex
CREATE INDEX "Payout_state_createdAt_idx" ON "Payout"("state", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderCall_requestId_idx" ON "ProviderCall"("requestId");

-- CreateIndex
CREATE INDEX "ProviderCall_createdAt_idx" ON "ProviderCall"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_fundingReference_key" ON "Campaign"("fundingReference");

-- AddForeignKey
ALTER TABLE "CreatorBankDetails" ADD CONSTRAINT "CreatorBankDetails_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_rewardCalculationId_fkey" FOREIGN KEY ("rewardCalculationId") REFERENCES "RewardCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


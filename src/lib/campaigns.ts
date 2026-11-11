import type {
  CampaignObjective,
  EventType,
  ParticipationMode,
} from "@/generated/prisma/enums";
import { parseNairaToMinorDecimal, type Minor } from "@/lib/money-server";

export type CampaignTermsInput = {
  id: string;
  name: string;
  summary: string | null;
  description: string | null;
  objectives: CampaignObjective[];
  participationMode: ParticipationMode;
  attributionModel: "LAST_ELIGIBLE_CLICK";
  attributionWindowDays: number;
  destinationUrl: string;
  startAt: Date | null;
  endAt: Date | null;
  budgetMinor: Minor;
  currency: string;
};

export type RewardRuleSnapshotInput = {
  name: string;
  eventType: string | null;
  amountMinor: Minor;
  maxCount: number | null;
  capMinor: Minor | null;
};

export type NormalizedRewardRule = {
  name: string;
  type: "PER_EVENT";
  eventType: EventType;
  amountMinor: Minor;
  maxCount: number | null;
  capMinor: Minor | null;
};

export function normalizeRewardRules(
  rules: {
    name: string;
    eventType: EventType;
    amountNaira: string;
    maxCount?: number | null;
    capNaira?: string | null;
  }[],
): NormalizedRewardRule[] {
  return rules.map((rule) => ({
    name: rule.name,
    type: "PER_EVENT",
    eventType: rule.eventType,
    amountMinor: parseNairaToMinorDecimal(rule.amountNaira),
    maxCount: rule.maxCount ?? null,
    capMinor: rule.capNaira ? parseNairaToMinorDecimal(rule.capNaira) : null,
  }));
}

/**
 * Immutable, participant-readable record of the terms in force for a campaign
 * version. Money values are stored as exact integer-kobo strings inside JSON.
 */
export function buildTermsSnapshot(
  campaign: CampaignTermsInput,
  rules: RewardRuleSnapshotInput[],
) {
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    campaign: {
      id: campaign.id,
      name: campaign.name,
      summary: campaign.summary,
      description: campaign.description,
      objectives: campaign.objectives,
      participationMode: campaign.participationMode,
      destinationUrl: campaign.destinationUrl,
      startAt: campaign.startAt?.toISOString() ?? null,
      endAt: campaign.endAt?.toISOString() ?? null,
      budgetMinor: campaign.budgetMinor.toString(),
      currency: campaign.currency,
    },
    attribution: {
      model: campaign.attributionModel,
      windowDays: campaign.attributionWindowDays,
      note: "Attribution uses the last eligible tracked creator click that occurred before the conversion and inside the attribution window. Events without evidence remain unattributed.",
    },
    rewardRules: rules.map((rule) => ({
      name: rule.name,
      eventType: rule.eventType,
      amountMinor: rule.amountMinor.toString(),
      maxCount: rule.maxCount,
      capMinor: rule.capMinor?.toString() ?? null,
    })),
    policies: {
      duplicateCounting: "Events are counted once across reward rules.",
      lateEvents: "Late events are accepted only while the campaign allows review.",
      corrections:
        "Approved rewards are corrected through an adjustment record, never silently reduced.",
      contentReview:
        "Approved content is separate from a verified conversion event.",
    },
  };
}

export function publishIssues(
  campaign: CampaignTermsInput,
  rules: RewardRuleSnapshotInput[],
): string[] {
  const issues: string[] = [];

  if (!campaign.name.trim()) {
    issues.push("Campaign name is required.");
  }

  try {
    const url = new URL(campaign.destinationUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      issues.push("Destination URL must use http or https.");
    }
  } catch {
    issues.push("Destination URL must be a valid URL.");
  }

  if (campaign.objectives.length === 0) {
    issues.push("Choose at least one campaign objective.");
  }

  if (rules.length === 0) {
    issues.push("Add at least one reward rule.");
  }

  if (rules.some((rule) => !rule.amountMinor.gt(0))) {
    issues.push("Every reward amount must be greater than zero.");
  }

  if (rules.some((rule) => !rule.eventType)) {
    issues.push("Every performance reward needs an event type.");
  }

  if (campaign.attributionWindowDays < 1 || campaign.attributionWindowDays > 90) {
    issues.push("Attribution window must be between 1 and 90 days.");
  }

  if (campaign.budgetMinor.lt(0)) {
    issues.push("Reward budget cannot be negative.");
  }

  if (
    campaign.startAt &&
    campaign.endAt &&
    campaign.startAt.getTime() >= campaign.endAt.getTime()
  ) {
    issues.push("Campaign end date must be after the start date.");
  }

  return issues;
}

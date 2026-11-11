import type {
  EventType,
  RewardRuleType,
} from "@/generated/prisma/enums";
import { ZERO_MINOR, type Minor } from "@/lib/money-server";

export type RewardRuleInput = {
  id: string;
  name: string;
  type: RewardRuleType;
  eventType: EventType | null;
  amountMinor: Minor;
  maxCount: number | null;
  capMinor: Minor | null;
};

export type EligibleEventInput = {
  id: string;
  eventType: EventType;
  occurredAt: Date;
};

export type RewardLineResult = {
  ruleId: string;
  conversionEventId: string | null;
  type: RewardRuleType;
  description: string;
  quantity: number;
  unitAmountMinor: Minor;
  amountMinor: Minor;
};

export type RewardResult = {
  lines: RewardLineResult[];
  totalMinor: Minor;
  countedEventIds: string[];
  skippedForBudgetMinor: Minor;
};

/**
 * Calculate performance rewards for one participant.
 *
 * Rules are applied in order. An event can only be counted once across all
 * rules unless a future campaign rule explicitly opts into duplicate counting.
 * `budgetRemainingMinor` is the campaign-wide budget still available after
 * earlier participants have been calculated; pass null for uncapped campaigns.
 *
 * All money arithmetic uses Prisma Decimal (exact decimal math), never binary
 * floats, so totals are always precise to the kobo.
 */
export function calculateReward(input: {
  rules: RewardRuleInput[];
  events: EligibleEventInput[];
  budgetRemainingMinor: Minor | null;
}): RewardResult {
  const events = [...input.events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const usedEventIds = new Set<string>();
  const lines: RewardLineResult[] = [];
  let totalMinor = ZERO_MINOR;
  let skippedForBudgetMinor = ZERO_MINOR;

  for (const rule of input.rules) {
    if (rule.type !== "PER_EVENT" || !rule.eventType) {
      continue;
    }

    const matching = events.filter(
      (event) =>
        event.eventType === rule.eventType && !usedEventIds.has(event.id),
    );
    const maxCount = rule.maxCount ?? Number.POSITIVE_INFINITY;
    let ruleCount = 0;
    let ruleTotalMinor = ZERO_MINOR;

    for (const event of matching) {
      if (ruleCount >= maxCount) {
        break;
      }

      if (rule.capMinor !== null && ruleTotalMinor.plus(rule.amountMinor).gt(rule.capMinor)) {
        break;
      }

      if (
        input.budgetRemainingMinor !== null &&
        totalMinor.plus(rule.amountMinor).gt(input.budgetRemainingMinor)
      ) {
        skippedForBudgetMinor = skippedForBudgetMinor.plus(rule.amountMinor);
        continue;
      }

      lines.push({
        ruleId: rule.id,
        conversionEventId: event.id,
        type: rule.type,
        description: `${rule.name} — eligible ${rule.eventType.toLowerCase()}`,
        quantity: 1,
        unitAmountMinor: rule.amountMinor,
        amountMinor: rule.amountMinor,
      });

      usedEventIds.add(event.id);
      ruleCount += 1;
      ruleTotalMinor = ruleTotalMinor.plus(rule.amountMinor);
      totalMinor = totalMinor.plus(rule.amountMinor);
    }
  }

  return {
    lines,
    totalMinor,
    countedEventIds: [...usedEventIds],
    skippedForBudgetMinor,
  };
}

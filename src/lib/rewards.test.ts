import { describe, expect, it } from "vitest";
import { calculateReward, type RewardRuleInput } from "@/lib/rewards";
import { toMinor } from "@/lib/money-server";

const registrationRule: RewardRuleInput = {
  id: "rule-reg",
  name: "Registration reward",
  type: "PER_EVENT",
  eventType: "REGISTRATION",
  amountMinor: toMinor(75_000),
  maxCount: null,
  capMinor: null,
};

const purchaseRule: RewardRuleInput = {
  id: "rule-purchase",
  name: "Purchase reward",
  type: "PER_EVENT",
  eventType: "PURCHASE",
  amountMinor: toMinor(250_000),
  maxCount: null,
  capMinor: null,
};

function event(id: string, eventType: "REGISTRATION" | "PURCHASE", day: number) {
  return {
    id,
    eventType,
    occurredAt: new Date(`2026-10-${String(day).padStart(2, "0")}T10:00:00Z`),
  };
}

describe("calculateReward", () => {
  it("counts each eligible event once", () => {
    const result = calculateReward({
      rules: [registrationRule],
      events: [event("e1", "REGISTRATION", 1), event("e2", "REGISTRATION", 2)],
      budgetRemainingMinor: null,
    });

    expect(result.totalMinor.toString()).toBe("150000");
    expect(result.lines).toHaveLength(2);
  });

  it("does not count the same event under two rules", () => {
    const duplicateRule: RewardRuleInput = {
      ...registrationRule,
      id: "rule-reg-2",
      name: "Second registration reward",
    };

    const result = calculateReward({
      rules: [registrationRule, duplicateRule],
      events: [event("e1", "REGISTRATION", 1)],
      budgetRemainingMinor: null,
    });

    expect(result.totalMinor.toString()).toBe("75000");
    expect(result.lines).toHaveLength(1);
  });

  it("applies max count per rule", () => {
    const result = calculateReward({
      rules: [{ ...registrationRule, maxCount: 2 }],
      events: [
        event("e1", "REGISTRATION", 1),
        event("e2", "REGISTRATION", 2),
        event("e3", "REGISTRATION", 3),
      ],
      budgetRemainingMinor: null,
    });

    expect(result.lines).toHaveLength(2);
    expect(result.totalMinor.toString()).toBe("150000");
  });

  it("applies a rule cap", () => {
    const result = calculateReward({
      rules: [{ ...registrationRule, capMinor: toMinor(150_000) }],
      events: [
        event("e1", "REGISTRATION", 1),
        event("e2", "REGISTRATION", 2),
        event("e3", "REGISTRATION", 3),
      ],
      budgetRemainingMinor: null,
    });

    expect(result.totalMinor.toString()).toBe("150000");
  });

  it("stops at the campaign budget", () => {
    const result = calculateReward({
      rules: [registrationRule, purchaseRule],
      events: [
        event("e1", "REGISTRATION", 1),
        event("e2", "REGISTRATION", 2),
        event("e3", "PURCHASE", 3),
      ],
      budgetRemainingMinor: toMinor(150_000),
    });

    expect(result.totalMinor.toString()).toBe("150000");
    expect(result.skippedForBudgetMinor.toString()).toBe("250000");
  });

  it("only pays events matching the rule type", () => {
    const result = calculateReward({
      rules: [purchaseRule],
      events: [event("e1", "REGISTRATION", 1), event("e2", "PURCHASE", 2)],
      budgetRemainingMinor: null,
    });

    expect(result.totalMinor.toString()).toBe("250000");
    expect(result.lines[0]?.conversionEventId).toBe("e2");
  });
});

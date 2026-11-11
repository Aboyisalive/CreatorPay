import type { Role } from "@/generated/prisma/enums";
import { forbidden } from "@/lib/errors";

export const CAMPAIGN_MANAGERS: Role[] = [
  "OWNER",
  "ADMIN",
  "CAMPAIGN_MANAGER",
];

export const REVIEWERS: Role[] = ["OWNER", "ADMIN", "REVIEWER"];

export const FINANCE_ROLES: Role[] = ["OWNER", "ADMIN", "FINANCE"];

export const ALL_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "CAMPAIGN_MANAGER",
  "REVIEWER",
  "FINANCE",
  "ANALYST",
];

export function assertRole(role: Role, allowed: Role[]): void {
  if (!allowed.includes(role)) {
    throw forbidden();
  }
}

export function canManageCampaigns(role: Role): boolean {
  return CAMPAIGN_MANAGERS.includes(role);
}

export function canApproveRewards(role: Role): boolean {
  return FINANCE_ROLES.includes(role);
}

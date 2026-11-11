/**
 * Ledger truth levels from the design system. Every status the API returns
 * maps to exactly one, so a colour always means the same thing:
 *
 * - paid:    bank-confirmed / irreversibly done (never pending work)
 * - escrow:  approved or payable, funds committed but not moved
 * - action:  someone needs to act (review, revision, awaiting funds)
 * - breach:  rejected, disputed, failed, reversed
 * - info:    in flight / telemetry (initiated, submitted, test)
 * - neutral: inert (draft, archived, expired)
 */
export type Truth = "paid" | "escrow" | "action" | "breach" | "info" | "neutral" | "live";

const TRUTH: Record<string, Truth> = {
  // Campaign
  DRAFT: "neutral",
  PUBLISHED: "live",
  PAUSED: "action",
  CLOSED: "neutral",
  ARCHIVED: "neutral",
  // Funding
  UNFUNDED: "neutral",
  AWAITING_FUNDS: "action",
  FUNDED: "paid",
  // Invitation / participant
  PENDING: "action",
  ACCEPTED: "live",
  DECLINED: "breach",
  EXPIRED: "neutral",
  ACTIVE: "live",
  COMPLETED: "paid",
  REMOVED: "breach",
  WITHDRAWN: "neutral",
  // Submission
  SUBMITTED: "info",
  UNDER_REVIEW: "action",
  REVISION_REQUESTED: "action",
  // Events
  VERIFIED: "paid",
  ELIGIBLE: "escrow",
  INELIGIBLE: "breach",
  // Rewards
  CALCULATED: "info",
  PENDING_REVIEW: "action",
  APPROVED: "info",
  PAYABLE: "escrow",
  PAYMENT_INITIATED: "info",
  PAID: "paid",
  PAYMENT_FAILED: "breach",
  DISPUTED: "breach",
  ADJUSTED: "info",
  REJECTED: "breach",
  // Payouts / deposits
  SETTLED: "paid",
  FAILED: "breach",
  UNKNOWN: "action",
  RECEIVED: "info",
  MATCHED: "paid",
  UNMATCHED: "action",
};

const LABELS: Record<string, string> = {
  AWAITING_FUNDS: "Awaiting funds",
  PENDING_REVIEW: "Pending review",
  UNDER_REVIEW: "Under review",
  REVISION_REQUESTED: "Revision requested",
  PAYMENT_INITIATED: "Payment initiated",
  PAYMENT_FAILED: "Payment failed",
  INVITE_ONLY: "Invite only",
};

export function truthOf(status: string | null | undefined): Truth {
  return (status && TRUTH[status]) || "neutral";
}

export function labelOf(status: string | null | undefined): string {
  if (!status) return "—";
  if (LABELS[status]) return LABELS[status];
  const words = status.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const TRUTH_CLASSES: Record<Truth, string> = {
  paid: "bg-paid-tint text-paid border-paid/20",
  escrow: "bg-escrow-tint text-escrow border-escrow/20",
  action: "bg-action-tint text-action border-action/20",
  breach: "bg-breach-tint text-breach border-breach/20",
  info: "bg-info-tint text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
  live: "bg-paid-tint text-paid border-paid/20",
};

export const MANAGER_ROLES = ["OWNER", "ADMIN", "CAMPAIGN_MANAGER"];
export const REVIEWER_ROLES = ["OWNER", "ADMIN", "CAMPAIGN_MANAGER", "REVIEWER"];
export const FINANCE_ROLES = ["OWNER", "ADMIN", "FINANCE"];

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  CAMPAIGN_MANAGER: "Campaign manager",
  REVIEWER: "Reviewer",
  FINANCE: "Finance",
  ANALYST: "Analyst",
};

export const EVENT_TYPES = [
  "REGISTRATION",
  "LEAD",
  "PURCHASE",
  "SUBSCRIPTION",
  "APPLICATION",
  "OTHER",
] as const;

export const DELIVERABLE_TYPES: Record<string, string> = {
  CONTENT_POST: "Post",
  CONTENT_STORY: "Story",
  CONTENT_REEL: "Reel",
  CONTENT_VIDEO: "Video",
  CONTENT_BLOG: "Blog",
  CONTENT_LIVE: "Live",
  OTHER: "Other",
};

export const EVIDENCE_TYPES: Record<string, string> = {
  URL: "Public URL",
  FILE: "File link",
  TEXT: "Text",
  SOCIAL_HANDLE: "Social handle",
};

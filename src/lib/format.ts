import { formatMoney } from "@/lib/money";

/**
 * Format an integer-kobo value for display. Accepts the serialized string form
 * from the API, a bigint, a plain number, or a server-side Decimal (which
 * stringifies to its exact integer value).
 */
export function formatMinor(
  value: string | number | bigint | { toString(): string } | null | undefined,
  currency = "NGN",
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  try {
    return formatMoney(BigInt(String(value)), currency);
  } catch {
    return "—";
  }
}

export function formatDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
): string {
  if (!value) {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-NG", options).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  PAUSED: "Paused",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  REMOVED: "Removed",
  WITHDRAWN: "Withdrawn",
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CALCULATED: "Calculated",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  PAYABLE: "Payable",
  PAYMENT_INITIATED: "Payment initiated",
  PAID: "Paid",
  PAYMENT_FAILED: "Payment failed",
  DISPUTED: "Disputed",
  ADJUSTED: "Adjusted",
  ELIGIBLE: "Eligible",
  INELIGIBLE: "Ineligible",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export function statusLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return STATUS_LABELS[value] ?? value.toLowerCase().replace(/_/g, " ");
}

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";

export function statusTone(value: string | null | undefined): Tone {
  switch (value) {
    case "PUBLISHED":
    case "ACTIVE":
    case "ACCEPTED":
    case "APPROVED":
    case "PAID":
    case "ELIGIBLE":
    case "VERIFIED":
      return "green";
    case "PAUSED":
    case "PENDING":
    case "PENDING_REVIEW":
    case "CALCULATED":
    case "PAYABLE":
    case "UNDER_REVIEW":
      return "amber";
    case "CLOSED":
    case "DISPUTED":
    case "PAYMENT_FAILED":
    case "REJECTED":
    case "INELIGIBLE":
    case "DECLINED":
    case "EXPIRED":
    case "REMOVED":
    case "WITHDRAWN":
      return "red";
    case "PAYMENT_INITIATED":
    case "ADJUSTED":
      return "blue";
    default:
      return "neutral";
  }
}

export const OBJECTIVE_LABELS: Record<string, string> = {
  AWARENESS: "Awareness",
  TRAFFIC: "Traffic",
  LEADS: "Leads",
  REGISTRATIONS: "Registrations",
  PURCHASES: "Purchases",
  OTHER: "Other",
};

export function objectiveLabel(value: string): string {
  return OBJECTIVE_LABELS[value] ?? value;
}

export function eventLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

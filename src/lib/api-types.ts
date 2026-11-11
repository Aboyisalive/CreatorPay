/** Response shapes of /api/v1 as consumed by the web client. Money is kobo strings. */

export type Minor = string;

export type Role = "OWNER" | "ADMIN" | "CAMPAIGN_MANAGER" | "REVIEWER" | "FINANCE" | "ANALYST";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  memberships: {
    id: string;
    role: Role;
    workspace: { id: string; name: string; slug: string; type: "BUSINESS" | "AGENCY"; currency: string };
  }[];
  creatorProfile: {
    id: string;
    displayName: string;
    bio: string | null;
    phone: string | null;
    socials: unknown;
  } | null;
};

export type RewardRule = {
  id: string;
  name: string;
  type: string;
  eventType: string | null;
  amountMinor: Minor;
  maxCount: number | null;
  capMinor: Minor | null;
};

export type CampaignListItem = {
  id: string;
  name: string;
  summary: string | null;
  status: string;
  fundingStatus: string;
  objectives: string[];
  participationMode: string;
  attributionWindowDays: number;
  budgetMinor: Minor;
  currency: string;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  rewardRules: RewardRule[];
  counts: { participants: number; clickEvents: number; conversionEvents: number };
};

export type Overview = {
  role: Role;
  queues: {
    submissionsToReview: number;
    unmatchedDeposits: { count: number; totalMinor: Minor } | null;
    rewardsAwaitingApproval: { count: number; totalMinor: Minor };
  };
  totals: {
    activeCampaigns: number;
    creators: number;
    activeCreators: number;
    clicks: number;
    eligibleClicks: number;
    verifiedEvents: number;
    payableMinor: Minor;
    paidMinor: Minor;
  };
  campaigns: Record<string, { clicks: number; eligibleClicks: number; verifiedEvents: number }>;
};

export type Participant = {
  id: string;
  status: string;
  acceptedAt: string | null;
  acceptedTermVersion: number | null;
  creator: { id: string; displayName: string; email: string };
  link: { id: string; token: string; path: string; destinationUrl: string; active: boolean } | null;
  clicks: number;
  events: number;
  latestReward: {
    id: string;
    version: number;
    status: string;
    totalMinor: Minor;
    calculatedAt: string;
    approvedAt: string | null;
  } | null;
};

export type EventRow = {
  id: string;
  externalEventId: string;
  eventType: string;
  occurredAt: string;
  receivedAt: string;
  source: string;
  verificationStatus: string;
  eligibilityStatus: string;
  reviewReason: string | null;
  isTest: boolean;
  valueMinor: Minor | null;
  creatorName: string | null;
};

export type CampaignDetail = {
  workspace: { id: string; name: string; currency: string };
  role: Role;
  campaign: {
    id: string;
    name: string;
    summary: string | null;
    description: string | null;
    objectives: string[];
    status: string;
    fundingStatus: string;
    participationMode: string;
    attributionModel: string;
    attributionWindowDays: number;
    destinationUrl: string;
    startAt: string | null;
    endAt: string | null;
    budgetMinor: Minor;
    currency: string;
    createdAt: string;
    currentTermVersion: {
      id: string;
      version: number;
      publishedAt: string | null;
      snapshot: Record<string, unknown>;
      rewardRules: RewardRule[];
    } | null;
  };
  stats: {
    participants: number;
    activeParticipants: number;
    rawClicks: number;
    eligibleClicks: number;
    totalEvents: number;
    eligibleEvents: number;
    calculatedMinor: Minor;
    approvedMinor: Minor;
    paidMinor: Minor;
  };
  participants: Participant[];
};

export type Deliverable = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  quantity: number;
  evidenceType: string;
  dueAt: string | null;
  _count?: { submissions: number };
};

export type Submission = {
  id: string;
  status: string;
  evidenceUrl: string | null;
  evidenceText: string | null;
  note: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  participant: {
    id: string;
    creatorProfile: { displayName: string; user: { email: string; name: string } };
  };
  deliverable: { name: string; type: string; evidenceType: string };
};

export type RewardLine = {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitAmountMinor: Minor;
  amountMinor: Minor;
  conversionEventId: string | null;
};

export type RewardRow = {
  id: string;
  participantId: string;
  creatorName: string;
  version: number;
  status: string;
  currency: string;
  totalMinor: Minor;
  calculatedAt: string;
  approvedAt: string | null;
  termVersion: number;
  breakdown: Record<string, unknown>;
  lines: RewardLine[];
};

export type Settlement = {
  id: string;
  amountMinor: Minor;
  currency: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
  recordedBy: { name: string; email: string } | null;
};

export type RewardDetail = {
  id: string;
  campaign: { id: string; name: string; currency: string };
  version: number;
  status: string;
  currency: string;
  totalMinor: Minor;
  breakdown: Record<string, unknown>;
  calculatedAt: string;
  approvedAt: string | null;
  approvedBy: { name: string; email: string } | null;
  disputedAt: string | null;
  disputeReason: string | null;
  notes: string | null;
  termVersion: { version: number; publishedAt: string | null };
  lines: RewardLine[];
  settlements: Settlement[];
  creator: { displayName: string; email: string };
  viewerIsCreator: boolean;
};

export type Payout = {
  id: string;
  rewardCalculationId: string;
  requestId: string;
  bankReference: string | null;
  amountMinor: Minor;
  currency: string;
  bankCode: string;
  accountNo: string;
  narration: string;
  state: string;
  rawCode: string | null;
  lastCheckedAt: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type Deposit = {
  id: string;
  campaignId: string | null;
  bankReference: string | null;
  amountMinor: Minor;
  currency?: string;
  senderHint?: string | null;
  state: string;
  matchedBy: string | null;
  createdAt?: string;
};

export type FundingInstructions = {
  fundingReference: string;
  poolAccountDisplay: string;
  fundingStatus: string;
  expiresAt: string | null;
};

export type TermVersion = {
  id: string;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  snapshot: Record<string, unknown>;
  rewardRules: RewardRule[];
  acceptedCount: number;
  createdBy: { name: string; email: string } | null;
  isCurrent: boolean;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type Activity = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  actor: { name: string; email: string } | null;
  createdAt: string;
};

export type CreatorCampaign = {
  participantId: string;
  status: string;
  acceptedAt: string | null;
  termVersion: number | null;
  campaign: {
    id: string;
    name: string;
    summary: string | null;
    status: string;
    businessName: string;
    attributionWindowDays: number;
    startAt: string | null;
    endAt: string | null;
    rewardRules: RewardRule[];
    currency: string;
  };
  link: { token: string; path: string } | null;
  clicks: number;
  eligibleClicks: number;
  events: number;
  eligibleEvents: number;
  reward: {
    id: string;
    version: number;
    status: string;
    totalMinor: Minor;
    currency: string;
    calculatedAt: string;
    approvedAt: string | null;
  } | null;
};

export type CreatorCampaignDetail = {
  campaign: {
    id: string;
    name: string;
    summary: string | null;
    description: string | null;
    objectives: string[];
    status: string;
    destinationUrl: string;
    attributionModel: string;
    attributionWindowDays: number;
    startAt: string | null;
    endAt: string | null;
    currency: string;
    businessName: string;
    deliverables: Deliverable[];
  };
  participation: {
    status: string;
    acceptedAt: string | null;
    termVersion: { version: number; snapshot: Record<string, unknown>; rewardRules: RewardRule[] } | null;
    submissions: number;
  };
  link: { id: string; token: string; path: string; active: boolean } | null;
  performance: { clicks: { total: number; eligible: number }; submissions: unknown };
};

export type CreatorSubmission = {
  id: string;
  status: string;
  deliverableId: string;
  evidenceUrl: string | null;
  evidenceText: string | null;
  note: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  campaign: { id: string; name: string; status: string };
  deliverable: { name: string; type: string; evidenceType: string };
};

export type CreatorReward = {
  id: string;
  campaign: { id: string; name: string; currency: string };
  version: number;
  status: string;
  totalMinor: Minor;
  currency: string;
  calculatedAt: string;
  approvedAt: string | null;
  breakdown: Record<string, unknown>;
  lines: RewardLine[];
};

export type BankDetails = {
  id: string;
  bankCode: string;
  accountNo: string;
  accountNameConfirmed: string | null;
  nubanOk: boolean;
  verifiedByBank: boolean;
};

export type InvitationPreview = {
  invitation: { email: string; status: string; expiresAt: string | null };
  business: { name: string };
  campaign: {
    id: string;
    name: string;
    summary: string | null;
    description: string | null;
    objectives: string[];
    status: string;
    destinationUrl: string;
    startAt: string | null;
    endAt: string | null;
    attributionWindowDays: number;
    budgetMinor: Minor;
    currency: string;
    rewardRules: RewardRule[];
    terms: Record<string, unknown> | null;
    termVersion: number | null;
  };
};

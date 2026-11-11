/**
 * Ledger account naming.
 *
 * A small, closed set of accounts. Two are parameterized by an entity id
 * (escrow per campaign, payable per creator); the rest are global. Keeping the
 * naming in one place means every ledger move spells account names identically.
 */

/** Funds a brand has sent that are not yet matched to a campaign. */
export const BRAND_FUNDS_IN_TRANSIT = "brand_funds_in_transit";
/** Platform revenue -- our cut of an approved reward. */
export const PLATFORM_FEES = "platform_fees";
/** Money that has actually left the platform to a creator. */
export const PAID_OUT = "paid_out";
/** Deposits we could not match, parked for manual resolution. */
export const UNMATCHED_DEPOSITS = "unmatched_deposits";

/** Funds earmarked for one campaign. */
export function campaignEscrowAccount(campaignId: string): string {
  return `campaign_escrow:${campaignId}`;
}

/** Amount owed to one creator, after approval and before payout settles. */
export function creatorPayableAccount(creatorProfileId: string): string {
  return `creator_payable:${creatorProfileId}`;
}

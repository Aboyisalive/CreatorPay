import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { getPaymentProvider } from "./provider";
import { checkNuban } from "./nuban";
import { paymentsConfig } from "./config";
import { recordAudit } from "@/lib/audit";

/**
 * Creator payout destination (bank details).
 *
 * A creator saves the account they want to be paid into. We validate the NUBAN
 * shape and checksum, then ask the provider for a verdict. Until Account
 * Enquiry is available the provider can only return `format_ok_unverified`, so
 * `verifiedByBank` stays false -- a saved account is never presented as
 * bank-confirmed. The creator-supplied `accountNameConfirmed` is what the
 * creator says the name is, not what the bank says.
 */

export type BankDetailsInput = {
  bankCode: string;
  accountNo: string;
  accountNameConfirmed: string;
};

export type BankDetailsResult = {
  id: string;
  bankCode: string;
  accountNo: string;
  accountNameConfirmed: string | null;
  nubanOk: boolean;
  verifiedByBank: boolean;
};

/** Save (create or replace) the payout account for a creator. */
export async function saveBankDetails(
  userId: string,
  actorWorkspaceId: string | null,
  input: BankDetailsInput,
): Promise<BankDetailsResult> {
  const profile = await db.creatorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw badRequest("Only creators can hold payout bank details.");
  }

  // Local NUBAN shape + checksum check. Skipped on the Forge sandbox: its
  // synthetic accounts (e.g. 0123456789, 10-digit OPay numbers) are not
  // checksum-valid NUBANs, and the bank's name enquiry is the real check.
  if (paymentsConfig().provider !== "forge") {
    const nuban = checkNuban(input.accountNo);
    if (!nuban.ok) {
      throw badRequest(nuban.reason ?? "Invalid account number.", { field: "accountNo" });
    }
  }

  // Provider verdict (mock or real). Real returns format_ok_unverified until
  // Account Enquiry exists; an invalid number is refused here.
  const check = await getPaymentProvider().verifyAccount(input.accountNo, input.bankCode);
  if (check.status === "invalid") {
    throw badRequest(check.reason ?? "Invalid account number.", { field: "accountNo" });
  }

  const saved = await db.creatorBankDetails.upsert({
    where: { creatorProfileId: profile.id },
    create: {
      creatorProfileId: profile.id,
      bankCode: input.bankCode,
      accountNo: input.accountNo,
      accountNameConfirmed: input.accountNameConfirmed,
      nubanOk: true,
      verifiedByBank: check.status === "verified",
    },
    update: {
      bankCode: input.bankCode,
      accountNo: input.accountNo,
      accountNameConfirmed: input.accountNameConfirmed,
      nubanOk: true,
      // True only when the bank's own name enquiry confirmed the account.
      verifiedByBank: check.status === "verified",
    },
  });

  await recordAudit({
    workspaceId: actorWorkspaceId,
    actorUserId: userId,
    action: "creator.bank_details.saved",
    entityType: "CreatorBankDetails",
    entityId: saved.id,
    metadata: { bankCode: saved.bankCode, verifiedByBank: saved.verifiedByBank },
  });

  return toResult(saved);
}

/** Read the payout account for a creator, or null if none saved. */
export async function getBankDetails(userId: string): Promise<BankDetailsResult | null> {
  const profile = await db.creatorProfile.findUnique({
    where: { userId },
    include: { bankDetails: true },
  });
  if (!profile?.bankDetails) {
    return null;
  }
  return toResult(profile.bankDetails);
}

/** Load a creator's confirmed bank details or throw (used before a payout). */
export async function requireBankDetails(creatorProfileId: string): Promise<{
  bankCode: string;
  accountNo: string;
}> {
  const details = await db.creatorBankDetails.findUnique({ where: { creatorProfileId } });
  if (!details) {
    throw notFound("This creator has no payout bank details on file.");
  }
  return { bankCode: details.bankCode, accountNo: details.accountNo };
}

function toResult(row: {
  id: string;
  bankCode: string;
  accountNo: string;
  accountNameConfirmed: string | null;
  nubanOk: boolean;
  verifiedByBank: boolean;
}): BankDetailsResult {
  return {
    id: row.id,
    bankCode: row.bankCode,
    accountNo: row.accountNo,
    accountNameConfirmed: row.accountNameConfirmed,
    nubanOk: row.nubanOk,
    verifiedByBank: row.verifiedByBank,
  };
}

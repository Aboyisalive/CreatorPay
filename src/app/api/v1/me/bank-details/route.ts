import { z } from "zod";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getBankDetails, saveBankDetails } from "@/lib/payments/bank-details";

const bankDetailsSchema = z.object({
  bankCode: z.string().min(1, "bankCode is required."),
  accountNo: z.string().regex(/^\d{11}$/, "accountNo must be 11 digits."),
  accountNameConfirmed: z.string().min(1, "accountNameConfirmed is required."),
});

/** Read the signed-in creator's own payout bank details. */
export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const bankDetails = await getBankDetails(user.id);
    return json({ bankDetails });
  });
}

/** Save (create or replace) the signed-in creator's payout bank details. */
export async function PUT(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const input = bankDetailsSchema.parse(await readJson(request));
    const bankDetails = await saveBankDetails(user.id, null, input);
    return json({ bankDetails });
  });
}

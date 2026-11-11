import { json, withApi } from "@/lib/api";
import { endSession } from "@/lib/auth";

export async function POST(request: Request) {
  return withApi(request, async () => {
    await endSession();
    return json({ ok: true });
  });
}

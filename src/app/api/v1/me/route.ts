import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    return json({ user });
  });
}

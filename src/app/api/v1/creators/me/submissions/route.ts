import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { forbidden } from "@/lib/errors";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();

    const creatorProfile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!creatorProfile) {
      throw forbidden("Only creators can view submissions.");
    }

    const submissions = await db.submission.findMany({
      where: { participant: { creatorProfileId: creatorProfile.id } },
      orderBy: { submittedAt: "desc" },
      include: {
        campaign: { select: { id: true, name: true, status: true } },
        deliverable: { select: { name: true, type: true, evidenceType: true } },
      },
    });

    return json({ submissions });
  });
}

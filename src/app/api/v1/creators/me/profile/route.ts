import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { conflict } from "@/lib/errors";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(2000).nullish(),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number.")
    .nullish(),
});

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();

    const profile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) {
      throw conflict("This account does not have a creator profile.");
    }

    return json({ profile });
  });
}

export async function PATCH(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const input = updateProfileSchema.parse(await readJson(request));

    const profile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) {
      throw conflict("This account does not have a creator profile.");
    }

    const updated = await db.creatorProfile.update({
      where: { userId: user.id },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        phone: input.phone,
      },
    });

    await recordAudit({
      workspaceId: null,
      actorUserId: user.id,
      action: "creator_profile.updated",
      entityType: "CreatorProfile",
      entityId: profile.id,
      metadata: { changes: input },
    });

    return json({ profile: updated });
  });
}

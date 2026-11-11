import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { conflict } from "@/lib/errors";
import { z } from "zod";
import { slugify } from "@/lib/tokens";
import { recordAudit } from "@/lib/audit";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Enter a workspace name.").max(120),
  type: z.enum(["BUSINESS", "AGENCY"]).default("BUSINESS"),
  currency: z.string().trim().length(3).default("NGN"),
});

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "workspace";
  let candidate = base;
  let n = 1;
  while (await db.workspace.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export async function POST(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const input = createWorkspaceSchema.parse(await readJson(request));

    const existing = await db.membership.findFirst({
      where: { userId: user.id },
    });
    if (existing) {
      throw conflict(
        "You already belong to a workspace. Each account starts with one workspace in the MVP.",
      );
    }

    const workspace = await db.workspace.create({
      data: {
        name: input.name,
        slug: await uniqueSlug(input.name),
        type: input.type,
        currency: input.currency.toUpperCase(),
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    });

    await recordAudit({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "workspace.created",
      entityType: "Workspace",
      entityId: workspace.id,
      metadata: { name: workspace.name, type: workspace.type },
    });

    return json({ workspace }, 201);
  });
}

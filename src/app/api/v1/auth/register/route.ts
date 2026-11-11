import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { hashPassword, startSession } from "@/lib/auth";
import { conflict } from "@/lib/errors";
import { slugify } from "@/lib/tokens";
import { registerSchema } from "@/lib/validation";

async function uniqueWorkspaceSlug(name: string): Promise<string> {
  const base = slugify(name) || "workspace";
  let candidate = base;
  let attempts = 0;

  while (await db.workspace.findUnique({ where: { slug: candidate } })) {
    attempts += 1;
    candidate = `${base}-${randomBytes(2).toString("hex")}`;
    if (attempts > 5) {
      candidate = `${base}-${randomBytes(4).toString("hex")}`;
      break;
    }
  }

  return candidate;
}

export async function POST(request: Request) {
  return withApi(request, async () => {
    const input = registerSchema.parse(await readJson(request));

    const existing = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      throw conflict("An account with that email already exists.");
    }

    const passwordHash = await hashPassword(input.password);
    const isBusiness = input.accountType === "BUSINESS";
    const workspaceName = input.workspaceName?.trim();

    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          // Accounts are single-role: only creator accounts get a creator
          // profile. Business accounts get a workspace instead.
          ...(isBusiness
            ? {}
            : { creatorProfile: { create: { displayName: input.name } } }),
        },
      });

      if (!isBusiness || !workspaceName) {
        return { user, workspace: null };
      }

      const slug = await uniqueWorkspaceSlug(workspaceName);
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug,
          type: "BUSINESS",
          memberships: {
            create: { userId: user.id, role: "OWNER" },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: workspace.id,
          actorUserId: user.id,
          action: "workspace.created",
          entityType: "Workspace",
          entityId: workspace.id,
          metadata: { name: workspaceName },
        },
      });

      return { user, workspace };
    });

    await startSession(created.user.id);

    return json(
      {
        user: {
          id: created.user.id,
          email: created.user.email,
          name: created.user.name,
        },
        workspace: created.workspace
          ? {
              id: created.workspace.id,
              name: created.workspace.name,
              slug: created.workspace.slug,
            }
          : null,
        accountType: input.accountType,
      },
      201,
    );
  });
}

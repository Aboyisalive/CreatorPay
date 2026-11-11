import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { startSession, verifyPassword } from "@/lib/auth";
import { unauthorized } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  return withApi(request, async () => {
    const input = loginSchema.parse(await readJson(request));

    const user = await db.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: { include: { workspace: true } },
      },
    });

    if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
      throw unauthorized("Email or password is incorrect.");
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await startSession(user.id);

    return json({
      user: { id: user.id, email: user.email, name: user.name },
      workspaces: user.memberships.map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        role: membership.role,
      })),
    });
  });
}

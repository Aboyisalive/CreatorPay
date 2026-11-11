import { hash, verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/errors";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "cp_session";
const SESSION_DAYS = 7;
const ISSUER = "creatorpay";
const AUDIENCE = "creatorpay-web";

function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(authSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function startSession(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export type AppUser = {
  id: string;
  email: string;
  name: string;
  memberships: {
    id: string;
    role: Role;
    workspace: {
      id: string;
      name: string;
      slug: string;
      type: "BUSINESS" | "AGENCY";
      currency: string;
    };
  }[];
  creatorProfile: {
    id: string;
    displayName: string;
    bio: string | null;
    phone: string | null;
    socials: unknown;
  } | null;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: "asc" },
      },
      creatorProfile: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    memberships: user.memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        type: membership.workspace.type,
        currency: membership.workspace.currency,
      },
    })),
    creatorProfile: user.creatorProfile
      ? {
          id: user.creatorProfile.id,
          displayName: user.creatorProfile.displayName,
          bio: user.creatorProfile.bio,
          phone: user.creatorProfile.phone,
          socials: user.creatorProfile.socials,
        }
      : null,
  };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw unauthorized();
  }
  return user;
}

export type WorkspaceContext = {
  workspace: AppUser["memberships"][number]["workspace"];
  role: Role;
  membershipId: string;
};

export async function requireWorkspace(
  user: AppUser,
  workspaceId?: string | null,
): Promise<WorkspaceContext> {
  const membership = workspaceId
    ? user.memberships.find((item) => item.workspace.id === workspaceId)
    : user.memberships[0];

  if (!membership) {
    throw forbidden(
      "You are not a member of that workspace. Create or join a workspace first.",
    );
  }

  return {
    workspace: membership.workspace,
    role: membership.role,
    membershipId: membership.id,
  };
}

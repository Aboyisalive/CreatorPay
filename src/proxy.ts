import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cp_session";

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret || secret.length < 32) {
    return false;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "creatorpay",
      audience: "creatorpay-web",
    });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  if (await hasValidSession(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/creator/:path*"],
};

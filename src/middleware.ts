import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight route gate. This only performs a coarse cookie check and
 * redirects anonymous users; every server page/action still performs full
 * session + role verification (defense in depth).
 */
const PROTECTED_PREFIXES = ["/dashboard", "/inbox", "/settings", "/notifications"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get("tb_session")?.value);
  if (!hasSession) {
    const url = new URL("/auth/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/inbox/:path*", "/settings/:path*", "/notifications/:path*"],
};

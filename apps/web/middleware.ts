/**
 * Next.js middleware — cookie-based UX gate for /dashboard, /tickets/* and
 * /transporter*.
 *
 * NOTE on security model (per plan §1 read_first):
 * This is a UX gate, not a security gate. We do NOT verify the JWT signature
 * here (Edge runtime + jose + DB lookup is heavy for middleware). We just
 * check that an `cm_access` cookie exists and pass it through to downstream
 * RSCs / route handlers via the `x-cm-user-token` request header. The
 * authoritative auth check happens server-side in `requireAuth()` on the
 * API, which validates JWT signature + expiry against the DB. This means a
 * forged cookie is rejected by the API.
 *
 * Public routes that bypass this gate (no redirect, no header injection):
 *   /, /results, /trips/:path*, /book/:path*, /tickets/lookup, /login,
 *   /register, /admin/login, /auth/:path*, /api/:path*
 * (/transporter* is NOT public — it is gated like /dashboard.)
 */
import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_PREFIXES = ["/dashboard", "/tickets", "/transporter", "/admin"]
const PUBLIC_TICKETS_PATH = "/tickets/lookup"
const PUBLIC_ADMIN_LOGIN = "/admin/login"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Belt-and-braces: explicit early return for the public lookup path even
  // though the matcher below includes /tickets/*.
  if (pathname === PUBLIC_TICKETS_PATH || pathname.startsWith(`${PUBLIC_TICKETS_PATH}/`)) {
    return NextResponse.next()
  }

  // Admin login lives OUTSIDE the traveler auth flow: unauthenticated hits on
  // /admin/* go to /admin/login (never /login). The login page itself is open.
  if (pathname === PUBLIC_ADMIN_LOGIN) {
    return NextResponse.next()
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  if (!isProtected) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get("cm_access")
  if (!cookie || !cookie.value) {
    const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/")
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = isAdminArea ? "/admin/login" : "/login"
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(loginUrl)
  }

  // Pass the JWT through to downstream RSCs and route handlers via a header.
  // We do NOT log the value (per plan §1).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-cm-user-token", cookie.value)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/dashboard/:path*", "/tickets/:path*", "/transporter/:path*", "/admin/:path*"],
}

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * Route protection rules.
 * Add paths that require authentication to `protectedPrefixes`.
 * Add paths that should redirect away when already authenticated to `authOnlyPaths`.
 */
const protectedPrefixes = ["/dashboard", "/profile", "/settings"]
const authOnlyPaths = ["/login"]

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isAuthenticated = !!session

  const isProtected = protectedPrefixes.some((prefix) =>
    nextUrl.pathname.startsWith(prefix)
  )
  const isAuthOnly = authOnlyPaths.some((path) =>
    nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", nextUrl.origin)
    loginUrl.searchParams.set("redirectTo", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthOnly && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin))
  }

  // Token refresh error: force re-login
  if (session?.error === "RefreshAccessTokenError") {
    const loginUrl = new URL("/login", nextUrl.origin)
    loginUrl.searchParams.set("redirectTo", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Skip Next.js internals and static assets.
     * Run on all other routes including API routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}

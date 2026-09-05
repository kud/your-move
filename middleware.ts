import { NextResponse, type NextRequest } from "next/server"

import { COOKIE, unseal } from "@/lib/auth"

/*
 * Everything is behind the gate except the login page, the OAuth routes, and the
 * PWA files a browser fetches before any session exists.
 *
 * Default-deny by construction: the matcher excludes a short list of paths, so a
 * route added tomorrow is protected without anyone remembering to protect it. An
 * allow-list of protected paths fails the opposite way — silently, and only for
 * the page someone just added.
 *
 * What the gate protects is different from the Companies board this grew out of.
 * There, one shared passphrase stood in front of one shared token, so the gate
 * WAS the credential. Here the cookie IS the user's own GitHub token, sealed, so
 * a session grants exactly what that person can already see on GitHub and
 * nothing more. There is no shared secret left to leak.
 */

export const middleware = async (request: NextRequest) => {
  const secret = process.env.SESSION_SECRET

  /* No secret configured means no way to open a session, so nobody is let in.
     The alternative — treating an unset variable as "auth disabled" — is how a
     misconfigured deployment silently serves a private board to the internet. */
  if (!secret)
    return new NextResponse("SESSION_SECRET is not configured", { status: 500 })

  if (await unseal(secret, request.cookies.get(COOKIE)?.value))
    return NextResponse.next()

  const login = new URL("/login", request.url)

  /* Where they were going, so the redirect after signing in lands there rather
     than dumping everyone on the board root. Path only — an absolute URL here
     would be an open redirect. */
  if (request.nextUrl.pathname !== "/")
    login.searchParams.set("to", request.nextUrl.pathname)

  return NextResponse.redirect(login)
}

export const config = {
  matcher: [
    /*
     * Everything except: the login page, the OAuth routes, Next's own assets,
     * and the PWA files a browser fetches before any session exists.
     *
     * That last group is not a convenience. A browser reads the manifest and the
     * icons to decide whether the thing is installable at all, and it does so
     * without carrying a session — so gating them does not protect anything, it
     * removes the install prompt and leaves no error to explain why. `sw.js` and
     * `offline` are the same shape of fact: the worker script is fetched on an
     * update check that may outlive the cookie, and the offline page is what it
     * serves when there is no network to log in over. None of the four holds a
     * single fact about the board — that is what makes excluding them safe, and
     * it is the property to re-check before adding a fifth.
     *
     * `api/auth` is a prefix, so it covers login, callback and logout alike.
     *
     * Kept in step with `pwa.test.ts`, which asserts this list exactly, so a
     * quiet widening fails a test rather than a review.
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js|offline).*)",
  ],
}

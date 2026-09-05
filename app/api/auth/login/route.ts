import { NextResponse } from "next/server"

import { issueState, STATE_COOKIE } from "@/lib/auth"

/*
 * Step one of the OAuth dance: send the user to GitHub.
 *
 * Deliberately an OAuth App rather than a GitHub App. A GitHub App's user token
 * is intersected with the App's INSTALLATIONS, so a board spanning your own
 * repos plus third-party ones you contribute to would show only where the App
 * happened to be installed — and the scope here changes weekly. An OAuth App has
 * no such restriction: the token sees what the user sees.
 */

const AUTHORIZE = "https://github.com/login/oauth/authorize"

/*
 * `repo` is broad, and it is the narrowest scope that does the job: reading
 * private issues and PRs and applying a label are both inside it, and GitHub
 * offers nothing finer for OAuth Apps. `read:org` is what makes org-owned repos
 * visible at all.
 */
const SCOPES = "repo read:org"

export const GET = async (request: Request) => {
  const secret = process.env.SESSION_SECRET
  const clientId = process.env.GITHUB_CLIENT_ID

  if (!secret || !clientId)
    return NextResponse.json({ error: "not configured" }, { status: 500 })

  const to = new URL(request.url).searchParams.get("to") ?? "/"
  const state = await issueState(secret, to)

  const authorize = new URL(AUTHORIZE)
  authorize.searchParams.set("client_id", clientId)
  authorize.searchParams.set("scope", SCOPES)
  authorize.searchParams.set("state", state)
  authorize.searchParams.set(
    "redirect_uri",
    new URL("/api/auth/callback", request.url).toString(),
  )

  const response = NextResponse.redirect(authorize)

  /*
   * The state also rides in a cookie, and the callback requires both to match.
   * Checking only the URL parameter would accept a state we minted for someone
   * else's browser — sealing proves WE issued it, the cookie proves it was
   * issued to THIS browser, and login CSRF needs both to be true.
   */
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })

  return response
}

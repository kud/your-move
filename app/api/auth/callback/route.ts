import { NextResponse } from "next/server"

import { COOKIE, LIFETIME_MS, readState, seal, STATE_COOKIE } from "@/lib/auth"

/*
 * Step two: GitHub hands back a code, we trade it for a token, and the token is
 * sealed into the session cookie. Nothing is written anywhere else — see
 * `lib/auth.ts` for why there is no store.
 *
 * The client secret is used here and only here. It never reaches the browser,
 * which is the entire reason this exchange happens server-side rather than in
 * the page.
 */

const ACCESS_TOKEN = "https://github.com/login/oauth/access_token"

const fail = (request: Request, why: string) =>
  NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(why)}`, request.url),
    303,
  )

export const GET = async (request: Request) => {
  const secret = process.env.SESSION_SECRET
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!secret || !clientId || !clientSecret)
    return NextResponse.json({ error: "not configured" }, { status: 500 })

  const params = new URL(request.url).searchParams

  /* GitHub reports a user's refusal as a redirect with `error`, not as a
     failure to arrive. Saying so plainly beats "something went wrong". */
  const denied = params.get("error")
  if (denied) return fail(request, denied)

  const code = params.get("code")
  const state = params.get("state") ?? undefined

  if (!code) return fail(request, "no_code")

  /*
   * Both halves of the CSRF check, and the cookie comparison is the half that
   * actually binds the flow to this browser. A sealed state proves only that we
   * minted it — for someone, at some point, not necessarily for whoever is
   * standing here now.
   */
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1)

  if (!state || !cookieState || state !== cookieState)
    return fail(request, "bad_state")

  const to = await readState(secret, state, Date.now())
  if (!to) return fail(request, "expired_state")

  const exchange = await fetch(ACCESS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: new URL("/api/auth/callback", request.url).toString(),
    }),
  })

  if (!exchange.ok) return fail(request, "exchange_failed")

  /*
   * GitHub answers a rejected exchange with HTTP 200 and an `error` field, so
   * `exchange.ok` above is necessary and nowhere near sufficient. Reading
   * `access_token` off a failed response yields undefined, which would seal
   * happily and produce a session that 401s on every request afterwards — a
   * login that looks like it worked and a board that is permanently empty.
   */
  const payload = (await exchange.json()) as {
    access_token?: string
    error?: string
  }

  if (payload.error || !payload.access_token)
    return fail(request, payload.error ?? "no_token")

  const response = NextResponse.redirect(new URL(to, request.url), 303)

  response.cookies.set(COOKIE, await seal(secret, payload.access_token), {
    httpOnly: true,
    secure: true,
    /*
     * `lax`, not `strict`. Under `strict` the cookie is withheld on the
     * cross-site navigation back from GitHub, so the very first request after a
     * successful login arrives unauthenticated and bounces to /login — a sign-in
     * that appears to fail and works on the second attempt.
     */
    sameSite: "lax",
    path: "/",
    maxAge: LIFETIME_MS / 1000,
  })

  response.cookies.delete(STATE_COOKIE)

  return response
}

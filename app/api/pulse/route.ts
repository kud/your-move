import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { COOKIE, unseal } from "@/lib/auth"
import { isDemoSession, sessionSecret } from "@/lib/demo"
import { fetchPulse, GitHubError } from "@/lib/github"

/*
 * "Has anything moved?" — for a point, once a minute, while the tab is visible.
 *
 * No cache and no store, the opposite of `/api/inbox` on purpose. That route
 * caches because a full read is expensive and a few minutes' age is honest when
 * labelled; this one is the thing that decides whether the label is still
 * true, so a cached answer would be a pulse confirming its own echo. It costs
 * one point, which is cheap enough not to need absorbing.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export const GET = async () => {
  const secret = sessionSecret()
  if (!secret)
    return NextResponse.json(
      { error: "not configured" },
      { status: 500, headers: NO_STORE },
    )

  const token = await unseal(secret, (await cookies()).get(COOKIE)?.value)
  if (!token)
    return NextResponse.json(
      { error: "no session" },
      { status: 401, headers: NO_STORE },
    )

  /* Sample data never moves, so the pulse is a fixed fingerprint. */
  if (isDemoSession(token))
    return NextResponse.json({ fingerprint: "demo" }, { headers: NO_STORE })

  try {
    return NextResponse.json(await fetchPulse(token), { headers: NO_STORE })
  } catch (error) {
    /* 401 passes through so the client can send the reader to sign in; any
       other failure is one the client ignores, so its exact status matters
       less than it being plainly not-ok. */
    const status = error instanceof GitHubError ? error.status : 502
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status, headers: NO_STORE },
    )
  }
}

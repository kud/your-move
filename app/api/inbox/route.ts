import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { COOKIE, unseal } from "@/lib/auth"
import { cached, lastResort, remember } from "@/lib/cache"
import { fetchInbox, GitHubError } from "@/lib/github"

/*
 * The board's only read.
 *
 * Behind a short-lived cache — see `lib/cache.ts` for why that is a cache and
 * not the mirror this design refuses. Cold costs a second; it never costs a
 * wrong answer.
 *
 * Node runtime rather than Edge: this one fans out several GraphQL calls and
 * merges them, which is squarely the shape Edge's CPU budget is not for.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = async (request: Request) => {
  const secret = process.env.SESSION_SECRET
  if (!secret)
    return NextResponse.json({ error: "not configured" }, { status: 500 })

  const token = await unseal(secret, (await cookies()).get(COOKIE)?.value)
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 })

  const repo = new URL(request.url).searchParams.get("repo") ?? undefined

  /* A filtered read is a different question and is not worth a second cache
     key for one user; only the whole-board read is cached. */
  if (!repo) {
    const hit = await cached(token)
    if (hit) return NextResponse.json(hit)
  }

  try {
    const inbox = await fetchInbox(token, { repo })
    if (!repo) await remember(token, inbox)
    return NextResponse.json(inbox)
  } catch (error) {
    /*
     * A 401 from GitHub means the token was revoked or expired, and the only
     * useful response is to make the client sign in again. Passing the status
     * through rather than flattening everything to 500 is what lets it tell the
     * difference between "log in again" and "GitHub is having a bad day" —
     * which are the two failures with genuinely different remedies.
     */
    const status = error instanceof GitHubError ? error.status : 502

    /*
     * A stale answer that says how stale it is beats an empty board that says
     * nothing could be read — especially for the rate limit, which is both the
     * likeliest failure and one that heals itself within the hour. Never for a
     * 401: a revoked session must send the reader to sign in, not show them a
     * board they are no longer entitled to.
     */
    if (status !== 401 && !repo) {
      const stale = await lastResort(token)
      if (stale)
        return NextResponse.json({
          ...stale,
          reasons: [
            ...stale.reasons,
            error instanceof Error ? error.message : "unknown",
          ],
        })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status },
    )
  }
}

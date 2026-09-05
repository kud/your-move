import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { COOKIE, unseal } from "@/lib/auth"
import { fetchInbox, GitHubError } from "@/lib/github"

/*
 * The board's only read. Every request goes to GitHub — see `lib/github.ts` for
 * why there is nothing cached between here and it.
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

  try {
    return NextResponse.json(await fetchInbox(token, { repo }))
  } catch (error) {
    /*
     * A 401 from GitHub means the token was revoked or expired, and the only
     * useful response is to make the client sign in again. Passing the status
     * through rather than flattening everything to 500 is what lets it tell the
     * difference between "log in again" and "GitHub is having a bad day" —
     * which are the two failures with genuinely different remedies.
     */
    const status = error instanceof GitHubError ? error.status : 502
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status },
    )
  }
}

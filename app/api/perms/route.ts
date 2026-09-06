import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { COOKIE, unseal } from "@/lib/auth"

/*
 * Whether you may write to each repo on the board.
 *
 * Only ever asked to answer one question: should the label control be there at
 * all. It used to always be there, and a repo you cannot write to answered a
 * tap with "You cannot label a repository you do not have write access to" —
 * after the request, after the wait, and after you had already decided to do
 * it. An affordance that fails on use is worse than one that is absent, because
 * absence is information and failure is only a rebuke.
 *
 * Not part of the inbox read, and that is deliberate rather than lazy: the repo
 * list is not known until those four queries return, so folding this in would
 * make the board's first paint wait on a second round trip to decide the
 * visibility of a `+`. It runs after the board is up, and its answer is cached
 * in the browser — a permission changes when someone is added to a repo, which
 * is not something worth a request per load.
 *
 * One aliased query rather than one per repo. `repository(owner:, name:)`
 * returns a single object with no connection under it, so twenty-one of them
 * still cost a single point of the hourly 5,000 — against 74 for the board
 * itself.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPHQL = "https://api.github.com/graphql"

/* These go into the document as literals, so anything looser is an injection
   surface — the same guard `/api/row` uses. */
const NAME = /^[\w.-]+$/

/** More than a board has lanes; a bound rather than a limit anyone will meet. */
const MAX = 60

export const GET = async (request: Request) => {
  const secret = process.env.SESSION_SECRET
  if (!secret)
    return NextResponse.json({ error: "not configured" }, { status: 500 })

  const token = await unseal(secret, (await cookies()).get(COOKIE)?.value)
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 })

  const asked = (new URL(request.url).searchParams.get("repos") ?? "")
    .split(",")
    .map((repo) => repo.trim())
    .filter(Boolean)
    .slice(0, MAX)

  const repos = asked.filter((repo) => {
    const [owner, name, ...rest] = repo.split("/")
    return !rest.length && owner && name && NAME.test(owner) && NAME.test(name)
  })

  if (!repos.length) return NextResponse.json({ permissions: {} })

  const query = `{
  rateLimit { cost remaining resetAt }
${repos
  .map((repo, i) => {
    const [owner, name] = repo.split("/")
    return `  r${i}: repository(owner: "${owner}", name: "${name}") { viewerPermission }`
  })
  .join("\n")}
}`

  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "your-move",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  })

  if (response.status === 401)
    return NextResponse.json({ error: "token rejected" }, { status: 401 })

  const body = (await response.json()) as { data?: Record<string, any> }

  /*
   * A repo that errored — deleted, renamed, or simply not visible to this
   * token — comes back null while its siblings still resolve. It is left out
   * rather than guessed at in either direction: absent means "unknown", and the
   * caller treats unknown as writable, so a failure here can never remove a
   * control that would have worked.
   */
  const permissions: Record<string, string> = {}
  repos.forEach((repo, i) => {
    const permission = body.data?.[`r${i}`]?.viewerPermission
    if (permission) permissions[repo] = permission
  })

  return NextResponse.json({
    permissions,
    budget: body.data?.rateLimit ?? null,
  })
}

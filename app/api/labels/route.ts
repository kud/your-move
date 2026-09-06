import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { COOKIE, unseal } from "@/lib/auth"

/*
 * The one write this app does: add or remove a label on a row.
 *
 * One verb, deliberately. Not label creation, not renaming, not bulk edits —
 * building a write seam for exactly one action is what stops it becoming a write
 * layer, and everything past this point is better done on GitHub itself.
 *
 * REST rather than GraphQL, and for once REST is genuinely simpler: the mutation
 * `addLabelsToLabelable` wants the labelable's node id and the label's node id,
 * neither of which a row carries — so using it would mean two lookups before the
 * write. The REST endpoint takes `owner/repo`, a number and label NAMES, which
 * is exactly what is already on screen.
 */

const API = "https://api.github.com"

const headersFor = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "User-Agent": "your-move",
})

const session = async () => {
  const secret = process.env.SESSION_SECRET
  if (!secret) return undefined
  return unseal(secret, (await cookies()).get(COOKIE)?.value)
}

/*
 * `owner/name`, and nothing else.
 *
 * This value goes into a URL PATH, which is worse than it looks: `fetch`
 * normalises `..` while parsing, and a `#` or `?` truncates everything the
 * template appends after it — so an unguarded `repo` chooses the endpoint
 * rather than filling in a segment, on the DELETE branch as much as the others.
 * `SameSite=Lax` and the absence of an XSS surface mean this was defence in
 * depth rather than a live hole, but it is the same three lines its two
 * siblings already carry, and the only route that did not.
 */
const NAME = /^[\w.-]+$/
const named = (repo: string | null | undefined) => {
  const [owner, name, ...rest] = (repo ?? "").split("/")
  return Boolean(
    !rest.length && owner && name && NAME.test(owner) && NAME.test(name),
  )
}

/** The labels a repo actually has, for the picker. */
export const GET = async (request: Request) => {
  const token = await session()
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 })

  const repo = new URL(request.url).searchParams.get("repo")
  if (!named(repo))
    return NextResponse.json({ error: "bad repo" }, { status: 400 })

  const response = await fetch(`${API}/repos/${repo}/labels?per_page=100`, {
    headers: headersFor(token),
    cache: "no-store",
  })

  if (!response.ok)
    return NextResponse.json(
      { error: `github ${response.status}` },
      { status: response.status },
    )

  const labels = (await response.json()) as { name: string; color: string }[]
  return NextResponse.json({
    labels: labels.map(({ name, color }) => ({ name, color })),
  })
}

export const POST = async (request: Request) => {
  const token = await session()
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 })

  const { repo, number, label, action } = (await request.json()) as {
    repo?: string
    number?: number
    label?: string
    action?: "add" | "remove"
  }

  if (!named(repo) || !Number.isInteger(number) || !label || !action)
    return NextResponse.json({ error: "bad request" }, { status: 400 })

  const base = `${API}/repos/${repo}/issues/${number}/labels`

  const response =
    action === "add"
      ? await fetch(base, {
          method: "POST",
          headers: headersFor(token),
          body: JSON.stringify({ labels: [label] }),
        })
      : await fetch(`${base}/${encodeURIComponent(label)}`, {
          method: "DELETE",
          headers: headersFor(token),
        })

  /*
   * 403 here is the interesting one and worth passing through intact rather than
   * flattening: labels are repo-scoped and applying one needs write access, so
   * this is exactly what a row on somebody else's repo returns. The client says
   * so plainly instead of failing silently.
   */
  if (!response.ok)
    return NextResponse.json(
      {
        error:
          response.status === 403
            ? "You cannot label a repository you do not have write access to."
            : `github ${response.status}`,
      },
      { status: response.status },
    )

  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { COOKIE, unseal } from "@/lib/auth"

/*
 * One issue or pull request, in enough detail to decide — and no further.
 *
 * Deliberately not built on `@kud/gh`'s inbox query: that one is shaped to ask
 * about thirty things cheaply, and this asks about one thing properly. It costs
 * a single GraphQL point, which is why the detail view can afford to fetch on
 * open rather than pre-loading anything.
 *
 * What it does NOT ask for is the design: no diff, no file list, no full thread,
 * no reactions, no timeline. The moment this returns a diff, the app has become
 * a worse GitHub. Adding a field here is a product decision, not a data one.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRAPHQL = "https://api.github.com/graphql"

const CHECKS = `
  statusCheckRollup {
    state
    contexts(first: 30) {
      nodes {
        ... on CheckRun { name conclusion status detailsUrl }
        ... on StatusContext { context state targetUrl }
      }
    }
  }`

const query = (owner: string, name: string, number: number) => `
{
  rateLimit { cost remaining resetAt }
  repository(owner: "${owner}", name: "${name}") {
    issueOrPullRequest(number: ${number}) {
      __typename
      ... on Issue {
        number title url state body createdAt
        author { login }
        labels(first: 20) { nodes { name } }
        comments(last: 3) { nodes { author { login } createdAt body } }
      }
      ... on PullRequest {
        number title url state body createdAt isDraft mergeable reviewDecision
        author { login }
        labels(first: 20) { nodes { name } }
        reviews(last: 20) { nodes { author { login } state submittedAt } }
        reviewThreads(first: 30) { nodes { isResolved } }
        comments(last: 3) { nodes { author { login } createdAt body } }
        commits(last: 1) { nodes { commit { ${CHECKS} } } }
      }
    }
  }
}`

export const GET = async (request: Request) => {
  const secret = process.env.SESSION_SECRET
  if (!secret)
    return NextResponse.json({ error: "not configured" }, { status: 500 })

  const token = await unseal(secret, (await cookies()).get(COOKIE)?.value)
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 })

  const params = new URL(request.url).searchParams
  const repo = params.get("repo") ?? ""
  const number = Number(params.get("number"))

  /* `owner/name` and a positive integer, or nothing. These go into a GraphQL
     document as literals, so anything looser is an injection surface. */
  const [owner, name] = repo.split("/")
  if (!owner || !name || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name))
    return NextResponse.json({ error: "bad repo" }, { status: 400 })
  if (!Number.isInteger(number) || number < 1)
    return NextResponse.json({ error: "bad number" }, { status: 400 })

  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "your-move",
    },
    body: JSON.stringify({ query: query(owner, name, number) }),
    cache: "no-store",
  })

  if (response.status === 401)
    return NextResponse.json({ error: "token rejected" }, { status: 401 })

  const body = (await response.json()) as { data?: any; errors?: any[] }

  const node = body.data?.repository?.issueOrPullRequest
  if (!node) {
    const detail = Array.isArray(body.errors)
      ? body.errors
          .map((e) => e?.message)
          .join("; ")
          .slice(0, 200)
      : "not found"
    return NextResponse.json({ error: detail }, { status: 502 })
  }

  const checks: any[] =
    node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? []

  return NextResponse.json({
    kind: node.__typename === "PullRequest" ? "pr" : "issue",
    number: node.number,
    title: node.title,
    url: node.url,
    state: node.state,
    isDraft: node.isDraft ?? false,
    mergeable: node.mergeable ?? null,
    reviewDecision: node.reviewDecision ?? null,
    author: node.author?.login,
    createdAt: node.createdAt,
    body: typeof node.body === "string" ? node.body.slice(0, 4000) : "",
    labels: (node.labels?.nodes ?? []).map((l: any) => l?.name).filter(Boolean),
    unresolved: (node.reviewThreads?.nodes ?? []).filter(
      (t: any) => t && !t.isResolved,
    ).length,
    /* Failures first: the reason you opened this is far more likely to be the
       one that is red than the twenty that are green. */
    checks: checks
      .filter(Boolean)
      .map((c: any) => ({
        name: c.name ?? c.context ?? "check",
        state: (c.conclusion ?? c.state ?? c.status ?? "").toString(),
        url: c.detailsUrl ?? c.targetUrl ?? null,
      }))
      .sort((a, b) => Number(rank(a.state)) - Number(rank(b.state))),
    reviews: (node.reviews?.nodes ?? [])
      .filter((r: any) => r?.author?.login && r.state !== "COMMENTED")
      .map((r: any) => ({ login: r.author.login, state: r.state })),
    comments: (node.comments?.nodes ?? []).map((c: any) => ({
      login: c?.author?.login ?? "someone",
      at: c?.createdAt,
      body: typeof c?.body === "string" ? c.body.slice(0, 600) : "",
    })),
    budget: body.data?.rateLimit ?? null,
  })
}

const rank = (state: string) =>
  /FAIL|ERROR|CANCEL|TIMED/i.test(state)
    ? 0
    : /PENDING|IN_PROGRESS|QUEUED|EXPECTED/i.test(state)
      ? 1
      : 2

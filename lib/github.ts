import {
  buildInboxQueries,
  mergeInboxData,
  INBOX_SOURCES,
  type InboxSource,
} from "@kud/gh/inbox"
import { sortItems, toGHItem, whoseMove, type GHItem } from "@kud/gh-workflow"

/*
 * The whole data path, and it is deliberately short.
 *
 * GitHub is asked once per page load and nothing is stored: no mirror, no
 * webhooks, no backfill. The cost is a second of latency; the benefit is that
 * what you are looking at cannot be quietly wrong, which for a board whose only
 * job is telling you what is true is the trade worth making every time.
 *
 * `@kud/gh` builds the queries and merges the parts; `@kud/gh-workflow` decides
 * what a row is and whose move it is. Neither knows this is a browser. All that
 * is left here is the transport and the section vocabulary — which, per
 * `inbox.ts`'s own header, was always the surface's to choose.
 */

const GRAPHQL = "https://api.github.com/graphql"

/**
 * Which standing each source implies — the key `whoseMove` looks up.
 *
 * `authoredIssues` and `repoIssues` share `issues` because the distinction that
 * matters to the verdict is issue-versus-PR, not who opened it. `recentlyDone`
 * maps to nothing on purpose: it is history, and history has no move.
 */
const STANDING_OF: Record<InboxSource, string> = {
  myPRs: "mine",
  reviewRequests: "review",
  reviewed: "reviewed",
  assigned: "assigned",
  repoIssues: "issues",
  authoredIssues: "issues",
  repoPRs: "incoming",
  recentlyDone: "done",
}

export type Row = GHItem & {
  source: InboxSource
  move: "you" | "them"
}

export type Inbox = {
  rows: Row[]
  login?: string
  /** What the caller should show as "as of": this is a live read, not a store. */
  fetchedAt: number
  /** Sources GitHub refused. A partial answer is still worth rendering. */
  failed: InboxSource[]
  /*
   * What GitHub says is left of the hourly GraphQL budget, and when it resets.
   *
   * Not decoration: this inbox costs ~74 points a load, so a naive one-minute
   * poll spends 4,440 of a 5,000-point hour and the board dies of its own
   * refreshing. Every query already returns this; not reading it was the bug.
   */
  budget?: { remaining: number; resetAt: string }
  /*
   * Why they failed, deduplicated. Without this an empty board and a broken one
   * are the same picture: the first version of this swallowed every reason into
   * allSettled and reported eight failed sources with no way to tell whether the
   * token was wrong, the query too expensive, or the function simply timed out.
   */
  reasons: string[]
}

class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const ask = async (token: string, query: string): Promise<any> => {
  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      /* GitHub rejects GraphQL requests with no User-Agent. */
      "User-Agent": "your-move",
    },
    body: JSON.stringify({ query }),
    /* This route is the freshness guarantee; a cached fetch would quietly
       reintroduce the staleness the whole design exists to avoid. */
    cache: "no-store",
  })

  if (response.status === 401) throw new GitHubError("token rejected", 401)

  if (!response.ok)
    throw new GitHubError(`github ${response.status}`, response.status)

  const body = (await response.json()) as { data?: any; errors?: unknown[] }

  /*
   * A GraphQL error is HTTP 200 with an `errors` array, and it is routinely
   * PARTIAL — one search rejected, the rest fine. Throwing the whole part away
   * would lose sources that answered perfectly well, so `data` is returned
   * whenever there is any, and only a response with nothing usable fails.
   */
  if (!body.data) {
    const detail = Array.isArray(body.errors)
      ? body.errors
          .map((e: any) => e?.message ?? JSON.stringify(e))
          .join("; ")
          .slice(0, 300)
      : "no errors reported"
    throw new GitHubError(`graphql returned no data: ${detail}`, 502)
  }

  return body.data
}

const rowsFrom = (data: any, login?: string): Row[] =>
  INBOX_SOURCES.flatMap((source) => {
    const nodes: any[] = data?.[source]?.nodes ?? []

    return nodes.filter(Boolean).map((node) => {
      const item = toGHItem(node)
      return {
        ...item,
        source,
        move: whoseMove(
          item.health,
          STANDING_OF[source],
          undefined,
          Boolean(login && item.lastActor && item.lastActor !== login),
          item.pinned,
        ),
      }
    })
  })

/*
 * The same PR legitimately arrives from several searches — one you opened and
 * were asked to review is both `myPRs` and `reviewRequests`. Keeping the first
 * is not arbitrary: INBOX_SOURCES is ordered by how directly a source implies a
 * claim on you, so the earliest occurrence carries the strongest standing, and
 * a later duplicate could only weaken the verdict.
 */
const dedupe = (rows: Row[]): Row[] => {
  const seen = new Set<string>()
  return rows.filter((row) =>
    seen.has(row.url) ? false : (seen.add(row.url), true),
  )
}

export const fetchInbox = async (
  token: string,
  options: { repo?: string } = {},
): Promise<Inbox> => {
  const sources = [...INBOX_SOURCES]
  const queries = buildInboxQueries({ ...options, sources })

  /*
   * `allSettled`, not `all`. The queries are split precisely so one source
   * failing is one source missing rather than a blank page — using `all` here
   * would throw that away and give the strictest possible failure to the least
   * important source.
   */
  const settled = await Promise.allSettled(
    queries.map((query) => ask(token, query)),
  )

  /* A rejected token is not a partial failure — every part will fail the same
     way, and the caller needs to send the user back to sign in. */
  const rejected = settled.find(
    (r) => r.status === "rejected" && (r.reason as GitHubError)?.status === 401,
  )
  if (rejected) throw (rejected as PromiseRejectedResult).reason

  const parts = settled
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value)

  const reasons = [
    ...new Set(
      settled
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) =>
          r.reason instanceof Error ? r.reason.message : String(r.reason),
        ),
    ),
  ]

  const data = mergeInboxData(parts)
  const login: string | undefined = data?.viewer?.login

  const answered = new Set(
    INBOX_SOURCES.filter((source) => data?.[source]?.nodes),
  )

  return {
    rows: sortItems(dedupe(rowsFrom(data, login)) as GHItem[]) as Row[],
    login,
    fetchedAt: Date.now(),
    failed: INBOX_SOURCES.filter((source) => !answered.has(source)),
    budget: data?.rateLimit
      ? { remaining: data.rateLimit.remaining, resetAt: data.rateLimit.resetAt }
      : undefined,
    reasons,
  }
}

export { GitHubError }

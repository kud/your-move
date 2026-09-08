import {
  buildInboxQueries,
  mergeInboxData,
  sourceCoverage,
  INBOX_SOURCES,
  type InboxSource,
  type SourceCoverage,
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
  /*
   * What each source MATCHED, against what its cap let it return.
   *
   * The board is a live read with no store, so the one thing it can still be
   * quietly wrong about is a source whose answer is a sample. `reviewRequests`
   * asks for 20 and the account has 99: the column headed `20` was reporting
   * the cap and reading as a total, which is precisely the failure the
   * never-mirror rule exists to prevent — one layer in, where nothing looked
   * broken.
   *
   * Optional because a payload from `lib/cache.ts` or `lib/kept.ts` written
   * before this field existed has no coverage to report, and the honest
   * degradation is "we do not know" rather than "nothing is truncated".
   */
  coverage?: Partial<Record<InboxSource, SourceCoverage>>
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

/*
 * The board's filter does NOT reach this function, and that is a measured
 * decision rather than an unfinished one.
 *
 * The intuition is strong and wrong: the header says "130 hidden", so the fetch
 * looks like it is buying rows the render throws away, and narrowing the search
 * looks like the obvious saving. GraphQL is not billed that way. A search is
 * scored on the nodes it COULD return — `first: N` multiplied by the fragment
 * beneath it — so the price is set by the cap and the shape, and the number of
 * rows that actually match is not an input to it.
 *
 * Measured 2026-09-08 on this account, one source, identical fragment:
 *
 *   unscoped, 100 matched      cost 11   2,480 nodes
 *   owner-scoped, 100 matched  cost 11   2,480 nodes
 *   repo-scoped, ZERO matched  cost 11   2,480 nodes
 *
 * A search matching nothing at all costs exactly what one matching a hundred
 * rows costs. There is no budget behind the hidden rows to recover.
 *
 * Nor does scoping rescue the truncated source, which was the better reason to
 * want it. `reviewRequests` shows 20 of 99 — and all 99 sit inside the single
 * owner the filter selects, so the scope that was meant to shrink the set to
 * fit the cap leaves every row in it. Raising the cap instead fails on WALL
 * CLOCK at GitHub's proxy, independently of all of this: `first: 100` returns
 * 502 after ~11s scoped and unscoped alike, and still 502s with the nested
 * `reviewThreads` window cut to a fifth — so it is the search itself timing
 * out, not the nodes hanging off it. `first: 50` answers in 8-11s, which is not
 * headroom, it is the ceiling.
 *
 * What scoping does buy is latency — 0.7s against 3.9s where the scope is
 * genuinely narrow — and that is worth having on the day a repo view is wanted.
 * It is not a saving, and it must not be sold as one.
 *
 * The real cost lever is the fragment, not the scope: at `first: 20` this
 * source costs 11 points with `reviewThreads(first: 50)`, 5 with 20, and 3 with
 * 10. That belongs to `@kud/gh`, which owns the query, and it is the change to
 * make if the budget ever needs to come down.
 *
 * `repo` also stays the only scope this signature accepts. `owners` cannot be
 * added by interpolating one more qualifier: `user:@me` is REPLACED rather than
 * joined for a reason `@kud/gh` documents, and the value lands inside a GraphQL
 * string literal, which is the injection surface `app/api/inbox/route.ts`
 * deleted `?repo=` over. Both are library-side problems, and neither is a thing
 * to route around from here.
 */
export const fetchInbox = async (
  token: string,
  options: { repo?: string; doneWithinDays?: number } = {},
): Promise<Inbox> => {
  const sources = [...INBOX_SOURCES]

  /*
   * A week of receipts by default, thirty on request.
   *
   * Not a cost decision — measured, this source costs ONE point at either
   * window, because the query's price comes from the PR sources fetching checks
   * and threads rather than from how far back the closed search reaches. So it
   * is purely editorial: how long something stays worth seeing after it is
   * finished. A week is the answer most days; the wider window is there for the
   * day it is not, and is why there is no separate archive screen.
   */
  const queries = buildInboxQueries({
    ...options,
    sources,
    doneWithinDays: options.doneWithinDays ?? 7,
  })

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
    coverage: sourceCoverage(data),
  }
}

export { GitHubError }

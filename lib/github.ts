import {
  buildHealthQueries,
  buildInboxQueries,
  buildInboxQuery,
  healthIdsFrom,
  mergeHealth,
  mergeInboxData,
  sourceCoverage,
  cappedSources,
  INBOX_SOURCES,
  type InboxSource,
  type SourceCoverage,
} from "@kud/gh/inbox"
import {
  sortItems,
  toGHItem,
  whoseMove,
  type GHItem,
  type Move,
} from "@kud/gh-workflow"

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
  move: Move
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
/*
 * The cap the overflow tier asks for, named once.
 *
 * It is read twice — by the query, and by the coverage that has to be measured
 * against the SAME number. Two literals would drift the moment one moved, and
 * the failure would be silent in the worse direction: coverage measured against
 * the default 20 would call a filled column capped forever and keep firing an
 * overflow fetch that had already succeeded.
 */
const OVERFLOW_LIMITS = { reviewRequests: 100 } as const

/*
 * Coverage has to describe the BOARD, not the first request.
 *
 * `sourceCoverage` reads the tier it is handed, so left alone it would go on
 * reporting "showing the first 20" for a source the overflow tier has since
 * filled in — the banner contradicting the rows underneath it, which is the
 * lying by arithmetic the notice exists to prevent.
 *
 * Whichever tier SHOWED MORE wins, whole. Not field by field: `capped` is
 * `shown >= cap` and both halves of that moved between the tiers, so a merge
 * that took the larger `shown` and left the smaller `cap` beside it would
 * describe a fetch nobody made. Taking one tier's reading entire keeps the
 * three numbers a single snapshot, which is the only state that can be
 * reasoned about.
 *
 * It reports what the second tier actually returned rather than assuming it
 * returned everything: a hundred is a cap too, and an account with more than
 * that is still capped and must still say so.
 */
const coverageWith = (data: any, overflow: any) => {
  const base = sourceCoverage(data)
  if (!overflow) return base

  const merged = { ...base }
  for (const [source, seen] of Object.entries(
    sourceCoverage(overflow, OVERFLOW_LIMITS),
  )) {
    const was = merged[source as InboxSource]
    if (!was || !seen) continue
    merged[source as InboxSource] = seen.shown >= was.shown ? seen : was
  }
  return merged
}

/*
 * The third tier: the verdict the second one could not afford.
 *
 * Tier two buys a hundred review requests for one point by dropping the health
 * selection whole, which is honest and which leaves those rows `unknown` — the
 * dashed bar on the board is exactly this, and it says "unassessed", not
 * "nothing wanted here". On an account with a hundred of them that is most of
 * the column declining to answer the one question the app exists to answer.
 *
 * So the ids come back here, in batches, with the full selections. `@kud/gh`
 * owns the cost reasoning — see `HEALTH_BATCH_SIZE`, where the batching is
 * measured and where it is a MECHANISM rather than a tuning knob: one 100-id
 * request 502s at eleven seconds exactly as the search did, because the wall
 * clock belongs to expanding the nodes and not to the endpoint. What is left
 * here is transport, which is this file's whole job.
 *
 * Sequential rather than fired with tier two, and that is forced rather than
 * chosen: this needs the ids only tier two can return. Three round trips on a
 * truncating account, behind the same ten-minute cache, and not one extra
 * request for an account that never truncates.
 *
 * `allSettled`, so a dead batch is a batch that merges nothing. That is the
 * whole failure path and it needs no branch: a node that merges nothing keeps
 * no health keys, `healthOf` reads the absence, `whoseMove` answers `unknown`,
 * and the row draws the same dashed bar it drew before we tried. Degrading to
 * fewer verdicts is safe; degrading to a guessed one is the thing every layer
 * of this chain is built to refuse.
 *
 * Scoped to `reviewRequests` for the same reason tier two is: it is the only
 * source that truncates AND carries health. The issue sources truncate too and
 * have no health to fetch.
 */
const withHealth = async (token: string, data: any): Promise<any> => {
  const ids = healthIdsFrom(data, ["reviewRequests"])
  if (ids.length === 0) return data

  const settled = await Promise.allSettled(
    buildHealthQueries(ids).map((query) => ask(token, query)),
  )

  return mergeHealth(
    data,
    settled
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value),
  )
}

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

  /*
   * The second tier, and it only exists because the first one has a ceiling it
   * cannot be argued out of.
   *
   * `reviewRequests` truncates at 20 of 99 on a heavy account and the cap will
   * not lift: the full fragment costs 11 points at `first: 20`, 28 at 50, and
   * 502s twice at 100 after about eleven seconds. That 502 is the search timing
   * out at GitHub's proxy rather than a node-count refusal — cutting the review
   * thread window by 65% still 502s — so no full-fragment window reaches 99.
   * The minimal fragment at `first: 100` costs ONE point and answers in 2.1s.
   *
   * Sequential rather than fired alongside the first batch, and that is the
   * trade taken deliberately: guarding on `truncatedSources` costs one extra
   * round trip to the accounts that actually truncate, and costs nothing at all
   * to everyone else. Firing it always would flatten the latency but would
   * fetch a hundred rows on every load for the majority who have nine.
   *
   * Merged AFTER the full rows so `dedupe` keeps the full one on a URL
   * collision — the overflow row is the same PR with less known about it, and
   * the earlier occurrence is the one carrying a verdict.
   */
  const capped = cappedSources(data)
  const overflow = capped.includes("reviewRequests")
    ? await ask(
        token,
        buildInboxQuery({
          ...options,
          sources: ["reviewRequests"],
          shape: "minimal",
          limits: OVERFLOW_LIMITS,
        }),
      ).catch(() => undefined)
    : undefined

  /* Everything downstream reads the enriched copy, so an overflow row that got
     its verdict is indistinguishable from a first-tier one — same health, same
     last actor, same activity age. One that did not is unchanged, which is the
     state the board already knows how to draw. */
  const enriched = overflow ? await withHealth(token, overflow) : undefined

  const login: string | undefined = data?.viewer?.login

  const answered = new Set(
    INBOX_SOURCES.filter((source) => data?.[source]?.nodes),
  )

  return {
    rows: sortItems(
      dedupe([
        ...rowsFrom(data, login),
        ...(enriched ? rowsFrom(enriched, login) : []),
      ]) as GHItem[],
    ) as Row[],
    login,
    fetchedAt: Date.now(),
    failed: INBOX_SOURCES.filter((source) => !answered.has(source)),
    budget: data?.rateLimit
      ? { remaining: data.rateLimit.remaining, resetAt: data.rateLimit.resetAt }
      : undefined,
    reasons,
    coverage: coverageWith(data, enriched),
  }
}

export { GitHubError }

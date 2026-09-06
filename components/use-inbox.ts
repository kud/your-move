"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { Inbox } from "@/lib/github"

/*
 * Polling, not a stream.
 *
 * The board this grew out of used SSE because it was watching a local
 * process write files, and an event was the only way to know something had
 * happened. GitHub offers no such signal without webhooks, and a webhook needs
 * an always-on endpoint and somewhere to put what arrives — the mirror this
 * whole design refuses. So the page asks again, on an interval, and says
 * honestly how old the answer is.
 *
 * The liveness vocabulary is kept from that board because it was the good part:
 * a board that cannot say whether it is current is worse than one that is
 * merely slow, and "as of two minutes ago" is a thing a cache can say truthfully
 * where a mirror structurally cannot.
 */

export type Liveness = "live" | "refreshing" | "stale" | "offline" | "expired"

/** Past this, the answer on screen stops being worth trusting silently. */
const STALE_AFTER_MS = 8 * 60 * 1000

/*
 * Five minutes, and the number is arithmetic rather than taste.
 *
 * One load of this inbox costs about 74 GraphQL points. GitHub grants 5,000 an
 * hour, so a sixty-second poll spends 4,440 of them doing nothing but asking —
 * and the first version did exactly that, exhausted the budget, and rendered an
 * empty board that blamed GitHub.
 *
 * Ten minutes is ~440 an hour, under a tenth of the budget. That matters because
 * this app is not the only thing spending it: the terminal surface uses the same
 * account, so does every `gh` command, and a second tab is a second poller. The
 * board should be a small part of the bill, not most of it.
 */
const POLL_MS = 10 * 60 * 1000

/*
 * Returning to a backgrounded tab is when the answer is most likely stale — but
 * refetching on every visibility change turns tab-switching into a quota leak.
 * Only ask if what is on screen is older than this.
 */
const REFETCH_IF_OLDER_MS = 2 * 60 * 1000

/*
 * Below this many points left, stop polling and let the reader ask explicitly.
 * A board that spends the last of the budget on an automatic refresh leaves
 * nothing for the deliberate one.
 */
const BUDGET_FLOOR = 500

/*
 * The last good board, kept in this browser.
 *
 * There is a cache on the server too, and for this — the case it was built for —
 * it is nearly useless: it lives in a serverless instance's memory, so a cold
 * start has nothing, and it only ever remembers a COMPLETE answer. Spend the
 * hourly budget and every subsequent fetch fails, so there is often nothing to
 * fall back to precisely when a fallback is wanted.
 *
 * The browser has none of those problems. It is the same device that saw the
 * good answer, it survives instances and deploys, and it costs no
 * infrastructure. It also stays honest by construction: the stored board keeps
 * its original `fetchedAt`, so the page says "as of 40 minutes ago" rather than
 * pretending to be current. A board that is an hour old and says so beats an
 * empty one that says nothing could be read.
 */
const KEPT = "ym:last"

const keep = (inbox: Inbox) => {
  if (inbox.failed.length) return
  try {
    localStorage.setItem(KEPT, JSON.stringify(inbox))
  } catch {
    /* Quota, a private window, or storage refused outright. Losing the fallback
       is not worth a failed render. */
  }
}

const kept = (): Inbox | undefined => {
  try {
    const saved = localStorage.getItem(KEPT)
    return saved ? (JSON.parse(saved) as Inbox) : undefined
  } catch {
    return undefined
  }
}

export const useInbox = (initial?: Inbox, doneDays: 7 | 14 | 30 = 7) => {
  const [inbox, setInbox] = useState<Inbox | undefined>(initial)
  const [liveness, setLiveness] = useState<Liveness>(
    initial ? "live" : "refreshing",
  )
  const [now, setNow] = useState(() => Date.now())

  /* So the poll callback never closes over a stale inbox and can be a stable
     reference — a changing interval callback resubscribes on every render. */
  const inFlight = useRef(false)
  /* Held in a ref so `refresh` stays a stable reference — a changing callback
     resubscribes the interval on every render. */
  const doneDaysRef = useRef(doneDays)
  doneDaysRef.current = doneDays
  const lastFetched = useRef<number | undefined>(initial?.fetchedAt)
  const budget = useRef<number | undefined>(initial?.budget?.remaining)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLiveness((was) => (was === "expired" ? was : "refreshing"))

    try {
      /*
       * A deadline, because the failure without one is permanent.
       *
       * `inFlight` guards re-entry and clears in `finally` — but a promise that
       * never settles never reaches `finally`. A mobile radio that neither
       * errors nor completes (a dead zone, a tab Android froze and resumed, a
       * socket the OS never tore down) left that ref `true` for the life of the
       * document, and every later path bounced off it: the poll, the return to
       * visible, and the `online` listener all call this and return on line one.
       * The board froze until a reload — including after the network came back,
       * which is exactly the moment it was most trusted.
       */
      const response = await fetch(`/api/inbox?done=${doneDaysRef.current}`, {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      })

      /* A revoked token is terminal — retrying cannot fix it, and a board that
         silently keeps showing the last good answer while signed out is exactly
         the quiet staleness this design exists to avoid. */
      if (response.status === 401) return setLiveness("expired")
      if (!response.ok) {
        setInbox((was) => was ?? kept())
        return setLiveness("stale")
      }

      const next = (await response.json()) as Inbox
      setInbox(next)
      keep(next)
      lastFetched.current = next.fetchedAt
      budget.current = next.budget?.remaining
      setLiveness("live")
    } catch {
      /* fetch throws on network failure, which is the offline case rather than
         a bad answer from a reachable server. */
      setInbox((was) => was ?? kept())
      setLiveness("offline")
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    if (!initial) {
      const last = kept()
      if (last) {
        setInbox(last)
        setLiveness("stale")
      }
      void refresh()
    }

    const poll = setInterval(() => {
      /* Never let the automatic refresh be the thing that spends the last of
         the budget — the deliberate one matters more. */
      if (budget.current !== undefined && budget.current < BUDGET_FLOOR) return
      /* And never on a screen nobody is looking at. */
      if (document.visibilityState !== "visible") return
      void refresh()
    }, POLL_MS)
    /* The only thing this drives is a relative timestamp whose smallest unit
       is a minute, and it re-renders the tree. Half as often is invisible. */
    const tick = setInterval(() => setNow(Date.now()), 60 * 1000)

    /* Coming back to a backgrounded tab is the moment the answer on screen is
       most likely to be old, and the moment someone is most likely to act on
       it. Browsers also throttle timers in background tabs, so the interval
       alone cannot be relied on to have kept up. */
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      const at = lastFetched.current
      if (at && Date.now() - at < REFETCH_IF_OLDER_MS) return
      void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onVisible)

    return () => {
      clearInterval(poll)
      clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onVisible)
    }
  }, [initial, refresh])

  const applyLabel = useCallback(
    (repo: string, number: number, label: string, action: "add" | "remove") =>
      setInbox((was) =>
        was
          ? {
              ...was,
              rows: was.rows.map((row) =>
                row.repo === repo && row.number === number
                  ? {
                      ...row,
                      labels:
                        action === "add"
                          ? [...(row.labels ?? []), label]
                          : (row.labels ?? []).filter((l) => l !== label),
                    }
                  : row,
              ),
            }
          : was,
      ),
    [],
  )

  const age = inbox ? now - inbox.fetchedAt : 0

  return {
    inbox,
    refresh,
    applyLabel,
    age,
    /* Age wins over a nominally "live" state: a successful fetch five minutes
       ago is not live any more, whatever the last request reported. */
    /* `refreshing` ages too. It used to be terminal-looking in the other
       direction: a request that never returned kept the ◐ and suppressed every
       banner, so an indefinitely broken board read as one that was working. */
    liveness:
      (liveness === "live" || liveness === "refreshing") &&
      age > STALE_AFTER_MS
        ? "stale"
        : liveness,
  }
}

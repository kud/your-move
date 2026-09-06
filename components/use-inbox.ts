"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { Inbox } from "@/lib/github"

/*
 * Polling, not a stream.
 *
 * The Companies board this grew out of used SSE because it was watching a local
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
 * empty board that blamed GitHub. At five minutes it is ~890 an hour, which
 * leaves room for opening the app, refreshing by hand, and the terminal surface
 * using the same account.
 */
const POLL_MS = 5 * 60 * 1000

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

export const useInbox = (initial?: Inbox) => {
  const [inbox, setInbox] = useState<Inbox | undefined>(initial)
  const [liveness, setLiveness] = useState<Liveness>(
    initial ? "live" : "refreshing",
  )
  const [now, setNow] = useState(() => Date.now())

  /* So the poll callback never closes over a stale inbox and can be a stable
     reference — a changing interval callback resubscribes on every render. */
  const inFlight = useRef(false)
  const lastFetched = useRef<number | undefined>(initial?.fetchedAt)
  const budget = useRef<number | undefined>(initial?.budget?.remaining)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLiveness((was) => (was === "expired" ? was : "refreshing"))

    try {
      const response = await fetch("/api/inbox", { cache: "no-store" })

      /* A revoked token is terminal — retrying cannot fix it, and a board that
         silently keeps showing the last good answer while signed out is exactly
         the quiet staleness this design exists to avoid. */
      if (response.status === 401) return setLiveness("expired")
      if (!response.ok) return setLiveness("stale")

      const next = (await response.json()) as Inbox
      setInbox(next)
      lastFetched.current = next.fetchedAt
      budget.current = next.budget?.remaining
      setLiveness("live")
    } catch {
      /* fetch throws on network failure, which is the offline case rather than
         a bad answer from a reachable server. */
      setLiveness("offline")
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    if (!initial) void refresh()

    const poll = setInterval(() => {
      /* Never let the automatic refresh be the thing that spends the last of
         the budget — the deliberate one matters more. */
      if (budget.current !== undefined && budget.current < BUDGET_FLOOR) return
      void refresh()
    }, POLL_MS)
    const tick = setInterval(() => setNow(Date.now()), 30 * 1000)

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

  const age = inbox ? now - inbox.fetchedAt : 0

  return {
    inbox,
    refresh,
    age,
    /* Age wins over a nominally "live" state: a successful fetch five minutes
       ago is not live any more, whatever the last request reported. */
    liveness: liveness === "live" && age > STALE_AFTER_MS ? "stale" : liveness,
  }
}

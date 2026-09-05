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
const STALE_AFTER_MS = 5 * 60 * 1000
const POLL_MS = 60 * 1000

export const useInbox = (initial?: Inbox) => {
  const [inbox, setInbox] = useState<Inbox | undefined>(initial)
  const [liveness, setLiveness] = useState<Liveness>(
    initial ? "live" : "refreshing",
  )
  const [now, setNow] = useState(() => Date.now())

  /* So the poll callback never closes over a stale inbox and can be a stable
     reference — a changing interval callback resubscribes on every render. */
  const inFlight = useRef(false)

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

      setInbox((await response.json()) as Inbox)
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

    const poll = setInterval(() => void refresh(), POLL_MS)
    const tick = setInterval(() => setNow(Date.now()), 30 * 1000)

    /* Coming back to a backgrounded tab is the moment the answer on screen is
       most likely to be old, and the moment someone is most likely to act on
       it. Browsers also throttle timers in background tabs, so the interval
       alone cannot be relied on to have kept up. */
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
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

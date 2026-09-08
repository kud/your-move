"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { Inbox } from "@/lib/github"
import { readKept, writeKept } from "@/lib/kept"

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
 * The last good board is kept in the browser rather than leant on from the
 * server cache, and `lib/kept.ts` owns the whole of that policy — the schema
 * stamp, the age ceiling, and what may be believed after a round trip.
 *
 * Why the browser at all: the server cache lives in a serverless instance's
 * memory, so a cold start has nothing, and it only ever remembers a COMPLETE
 * answer. Spend the hourly budget and every subsequent fetch fails, so there is
 * often nothing to fall back to precisely when a fallback is wanted. The browser
 * has none of those problems — same device, survives deploys, costs no
 * infrastructure — and it stays honest by construction, because the stored board
 * keeps its original `fetchedAt` and the page says "as of 40 minutes ago" rather
 * than pretending to be current.
 */

/*
 * `offline` mode, which `/offline` runs in — and the reason it is a mode here
 * rather than a second hook.
 *
 * That route renders the stored board so the reader has something, but it is
 * NOT the board's address. Everything that would normally bring it up to date —
 * the mount fetch, the poll, the return-to-visible refetch, the button — must
 * therefore leave rather than succeed in place, because a live board rendered
 * at `/offline` is a page whose URL contradicts its contents, and the next
 * navigation or reload from there is a coin toss.
 *
 * Leaving is also what keeps `public/sw.js` out of this change entirely. The
 * service worker's rule — never put an access-controlled response into Cache
 * Storage — is untouched and stays untouched; this route reads `localStorage`,
 * which is same-origin script-gated storage the worker never sees.
 */
export const useInbox = (
  initial?: Inbox,
  doneDays: 7 | 14 | 30 = 7,
  offline = false,
) => {
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
  /* Same reason: the one caller passes a constant, but reading it through a ref
     is what lets `refresh` keep an empty dependency list. */
  const offlineRef = useRef(offline)
  offlineRef.current = offline
  const lastFetched = useRef<number | undefined>(initial?.fetchedAt)
  const budget = useRef<number | undefined>(initial?.budget?.remaining)

  const refresh = useCallback(async () => {
    /* The refresh control is a link home here, not a request. Anything that
       fetched in place would paint a live board at the wrong URL. */
    if (offlineRef.current) return void location.assign("/")
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
        setInbox((was) => was ?? readKept())
        return setLiveness("stale")
      }

      const next = (await response.json()) as Inbox
      setInbox(next)
      writeKept(next)
      lastFetched.current = next.fetchedAt
      budget.current = next.budget?.remaining
      setLiveness("live")
    } catch {
      /* fetch throws on network failure, which is the offline case rather than
         a bad answer from a reachable server. */
      setInbox((was) => was ?? readKept())
      setLiveness("offline")
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    /* The only thing this drives is a relative timestamp whose smallest unit
       is a minute, and it re-renders the tree. Half as often is invisible. */
    const tick = setInterval(() => setNow(Date.now()), 60 * 1000)

    if (offline) {
      /* No mount fetch and no poll: there is nothing to ask and, on this route,
         nowhere to put an answer. The age label still ticks, because a board
         that stops saying how old it is stops being honest as it sits there.

         `online` navigates for the same reason the button does — reconnecting
         is precisely when a live board would otherwise appear at `/offline`. */
      const onOnline = () => location.assign("/")
      window.addEventListener("online", onOnline)
      return () => {
        clearInterval(tick)
        window.removeEventListener("online", onOnline)
      }
    }

    if (!initial) {
      const last = readKept()
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
  }, [initial, refresh, offline])

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
    /* Pinned, not merely initialised: nothing on this route can move it, and a
       state that cannot change should be stated once rather than defended at
       every setter. */
    liveness: offline
      ? "offline"
      : (liveness === "live" || liveness === "refreshing") &&
          age > STALE_AFTER_MS
        ? "stale"
        : liveness,
  }
}

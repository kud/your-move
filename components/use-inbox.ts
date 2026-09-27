"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { Inbox } from "@/lib/github"
import { readKept, writeKept } from "@/lib/kept"
import {
  isStale,
  mayAskAlone,
  PULSE_MS,
  pulseOutcome,
  sameBoard,
} from "@/lib/pulse"

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

/*
 * The backstop, not the heartbeat.
 *
 * One load of this inbox costs about 74 GraphQL points. GitHub grants 5,000 an
 * hour, so a sixty-second poll spends 4,440 of them doing nothing but asking —
 * and the first version did exactly that, exhausted the budget, and rendered an
 * empty board that blamed GitHub.
 *
 * It was ten minutes (~440 an hour) while it was the only thing keeping the
 * board current. The pulse does that now, for a point a minute, and reads only
 * when something moved — so this is left to catch what a pulse cannot see and
 * could afford to double. Twenty minutes is ~220 an hour. That still matters:
 * this app is not the only thing spending the budget — the terminal surface uses
 * the same account, so does every `gh` command, and a second tab is a second
 * poller.
 */
const POLL_MS = 20 * 60 * 1000

/*
 * How long a pressed refresh holds ◐, at the least.
 *
 * A quick answer comes back in tens of milliseconds, and a glyph that flickers
 * for one frame reads as nothing having happened — the press looked broken for
 * exactly the opposite reason it used to.
 */
const MIN_PRESSED_MS = 300

/* How long the one polite line answering a press stays in the live region. */
const ANNOUNCE_MS = 4000

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
  /*
   * Two clocks, and they answer different questions.
   *
   * `confirmedAt` is the last time GitHub told us the board was true — a full
   * read or any pulse that answered — and it is what staleness keys on.
   * `checkedAt` is narrower: the last pulse that found NOTHING had moved, and
   * it is what earns the header its `no change in` wording. A pulse that saw a
   * change it could not yet act on (`held`) confirms that GitHub is reachable
   * but not that the board is current, so it moves the first and clears the
   * second.
   */
  const [confirmedAt, setConfirmedAt] = useState<number | undefined>(
    initial?.fetchedAt,
  )
  const [checkedAt, setCheckedAt] = useState<number>()
  /* A pressed refresh, from the click until ◐ has been held long enough. */
  const [pressed, setPressed] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  /* So the poll callback never closes over a stale inbox and can be a stable
     reference — a changing interval callback resubscribes on every render. */
  const inFlight = useRef(false)
  const pressedRef = useRef(false)
  /* Held in a ref so `refresh` stays a stable reference — a changing callback
     resubscribes the interval on every render. */
  const doneDaysRef = useRef(doneDays)
  doneDaysRef.current = doneDays
  /* Same reason: the one caller passes a constant, but reading it through a ref
     is what lets `refresh` keep an empty dependency list. */
  const offlineRef = useRef(offline)
  offlineRef.current = offline
  const budget = useRef<number | undefined>(initial?.budget?.remaining)
  const inboxRef = useRef(initial)
  inboxRef.current = inbox
  const expiredRef = useRef(false)
  expiredRef.current = liveness === "expired"

  /*
   * The pulse's cursor: the last fingerprint, and nothing else. See
   * `lib/pulse.ts` for why a single string in a ref is not a mirror.
   *
   * `reads` counts completed full reads so a pulse that set off before one and
   * lands after it can tell, and drop its answer: its fingerprint describes the
   * world before the read, and recording it as the baseline would make the
   * next pulse call the read's own changes news.
   */
  const baseline = useRef<string | undefined>(undefined)
  const lastPulseRead = useRef<number | undefined>(undefined)
  const reads = useRef(0)
  const pulsing = useRef(false)

  const load = useCallback(
    async (fresh = false): Promise<Inbox | undefined> => {
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
        const response = await fetch(
          `/api/inbox?done=${doneDaysRef.current}${fresh ? "&fresh=1" : ""}`,
          {
            signal: AbortSignal.timeout(15_000),
            cache: "no-store",
          },
        )

        /* A revoked token is terminal — retrying cannot fix it, and a board that
         silently keeps showing the last good answer while signed out is exactly
         the quiet staleness this design exists to avoid. */
        if (response.status === 401) return void setLiveness("expired")
        if (!response.ok) {
          setInbox((was) => was ?? readKept())
          return void setLiveness("stale")
        }

        const next = (await response.json()) as Inbox
        setInbox(next)
        writeKept(next)
        budget.current = next.budget?.remaining
        /* The read's own timestamp, not the moment it landed: a cached answer is
         only as confirmed as when GitHub last gave it. */
        setConfirmedAt((was) => Math.max(was ?? 0, next.fetchedAt))
        baseline.current = undefined
        reads.current += 1
        setLiveness("live")
        return next
      } catch {
        /* fetch throws on network failure, which is the offline case rather than
         a bad answer from a reachable server. */
        setInbox((was) => was ?? readKept())
        setLiveness("offline")
      } finally {
        inFlight.current = false
      }
    },
    [],
  )

  /*
   * One pulse. Silent in every outcome but one: it never touches `liveness`
   * on the way out, so it draws no ◐ and no banner, and a failure is simply a
   * confirmation that did not arrive — the 8-minute rule notices that on its
   * own. The exception is a 401, which is the same terminal fact whichever
   * request finds it.
   */
  const pulse = useCallback(async () => {
    if (offlineRef.current || expiredRef.current) return
    if (pulsing.current || inFlight.current) return
    if (!mayAskAlone(budget.current)) return
    pulsing.current = true
    const readsAtStart = reads.current

    try {
      const response = await fetch("/api/pulse", {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      })
      if (response.status === 401) return void setLiveness("expired")
      if (!response.ok) return

      const { fingerprint, budget: left } = (await response.json()) as {
        fingerprint: string
        budget?: { remaining: number }
      }
      if (reads.current !== readsAtStart) return

      const at = Date.now()
      if (left) budget.current = left.remaining
      setConfirmedAt(at)
      setNow(at)

      const outcome = pulseOutcome({
        baseline: baseline.current,
        fingerprint,
        now: at,
        lastPulseRead: lastPulseRead.current,
        remaining: budget.current,
      })

      if (outcome === "baseline" || outcome === "same") {
        baseline.current = fingerprint
        setCheckedAt(at)
        return
      }

      setCheckedAt(undefined)
      if (outcome === "held") return

      /*
       * Fresh, past the server cache, because the pulse has just said GitHub
       * holds something the board does not. A cached read would hand back the
       * board already on screen, the next pulse would record that as the
       * baseline, and the change would be forgotten until the backstop.
       *
       * Applied silently: the board updates in place and the freshness goes to
       * `just now`. `use-notifier` announces what deserves announcing, exactly
       * as it does for any other read, and nothing else here does.
       */
      lastPulseRead.current = at
      pulsing.current = false
      await load(true)
    } catch {
      /* Network or timeout: silent, per the header above. */
    } finally {
      pulsing.current = false
    }
  }, [load])

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
      void load()
    }

    /* Never on a screen nobody is looking at, and never the thing that spends
       the last of the budget — the deliberate refresh matters more. */
    const visible = () => document.visibilityState === "visible"

    const beat = setInterval(() => {
      if (visible()) void pulse()
    }, PULSE_MS)

    const poll = setInterval(() => {
      if (!mayAskAlone(budget.current)) return
      if (visible()) void load()
    }, POLL_MS)

    /*
     * Coming back to a backgrounded tab is the moment the answer on screen is
     * most likely to be old, and the moment someone is most likely to act on
     * it. Browsers also throttle timers in background tabs, so the intervals
     * alone cannot be relied on to have kept up.
     *
     * It asks with a PULSE, not a read. It used to read — gated at two minutes
     * so tab-switching did not leak quota — and that was the right trade while
     * a read was the only question there was. A pulse answers the same question
     * for a point and reads only if the answer is yes.
     */
    const onVisible = () => {
      if (visible()) void pulse()
    }
    /* Reconnecting is different: the last thing this board knows may be a
       failure, and a pulse cannot turn `offline` back into a board. */
    const onOnline = () => void load()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)

    return () => {
      clearInterval(beat)
      clearInterval(poll)
      clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
    }
  }, [initial, load, offline, pulse])

  /*
   * Every caller outside this hook is a person asking. The server's cache
   * exists to absorb the poll, a second tab and a double page open — serving
   * it to someone who just pressed refresh hands them the board they already
   * had, and the press looks broken.
   *
   * The press is answered three ways and none of them moves the board: ◐ from
   * the click, held at least `MIN_PRESSED_MS`; the control's name becomes
   * `Refreshing` with `aria-busy`; and one polite line says what came of it.
   * A second press while one is in flight is ignored rather than disabled —
   * a disabled look would read as "you cannot refresh", which is not true.
   */
  const refresh = useCallback(async () => {
    if (offlineRef.current) return void location.assign("/")
    if (pressedRef.current || inFlight.current) return
    pressedRef.current = true
    setPressed(true)
    setAnnouncement("")
    const started = Date.now()
    const before = inboxRef.current

    const next = await load(true)

    const left = MIN_PRESSED_MS - (Date.now() - started)
    if (left > 0) await new Promise((done) => setTimeout(done, left))
    pressedRef.current = false
    setPressed(false)
    if (next)
      setAnnouncement(sameBoard(before, next) ? "Up to date" : "Updated")
  }, [load])

  /*
   * The baseline pulse goes straight after each read rather than waiting for
   * the next beat. The first pulse after a read only records — so anything
   * that moved between the read and that pulse would be folded into the
   * baseline and never read, until the backstop twenty minutes on. Asking at
   * once shrinks that blind spot from up to a minute to the length of a round
   * trip, for one point per read.
   */
  const fetchedAt = inbox?.fetchedAt
  useEffect(() => {
    if (offline || fetchedAt === undefined) return
    if (baseline.current === undefined) void pulse()
  }, [fetchedAt, offline, pulse])

  useEffect(() => {
    if (!announcement) return
    const clear = setTimeout(() => setAnnouncement(""), ANNOUNCE_MS)
    return () => clearTimeout(clear)
  }, [announcement])

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
    now,
    checkedAt,
    pressed,
    announcement,
    /* Confirmation wins over a nominally "live" state: a board nobody has
       confirmed in eight minutes is not live any more, whatever the last
       request reported. It used to key on the READ's age, back when a read was
       the only confirmation there was; see `isStale` for why it cannot now. */
    /* `refreshing` ages too. It used to be terminal-looking in the other
       direction: a request that never returned kept the ◐ and suppressed every
       banner, so an indefinitely broken board read as one that was working. */
    /* Pinned, not merely initialised: nothing on this route can move it, and a
       state that cannot change should be stated once rather than defended at
       every setter. */
    liveness: offline
      ? "offline"
      : (liveness === "live" || liveness === "refreshing") &&
          isStale(confirmedAt, now)
        ? "stale"
        : liveness,
  }
}

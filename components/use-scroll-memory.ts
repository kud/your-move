"use client"

import { useEffect, useRef, type RefObject } from "react"

/*
 * The board remembers where you were.
 *
 * Tapping a card opens GitHub, which on a phone means leaving the app. Coming
 * back, the position was gone — and on a board that scrolls in two axes with
 * twenty-odd lanes, "gone" means finding your place by hand every time you read
 * a ticket. That is the one interaction this app exists to make cheap.
 *
 * Two different things destroy it and both are handled, because from the
 * outside they are indistinguishable: Android froze or discarded the page, so
 * the return is a fresh document; or the app came back, refetched, and
 * re-sorted the lanes so the element you were snapped to moved underneath you.
 *
 * The first version of this failed for a reason worth writing down, because it
 * is the sort of bug that looks like a tuning problem:
 *
 *   The TARGET and the OBSERVATION were the same variable. Restoring on a board
 *   that had not reached its full width yet meant the browser CLAMPED the
 *   scroll — and the clamp fires a `scroll` event, which wrote the clamped
 *   position back over the target. The failed attempt destroyed the thing it
 *   was trying to apply, and there was only ever one attempt.
 *
 * So they are separate now: `want` is where you were and is cleared only when
 * it is actually reached; `at` is where the board is. Restores are retried
 * until the content is wide enough to hold them, and abandoned the moment you
 * touch the board yourself.
 */

const KEY = "ym:scroll"

/** Landing within a pixel or two is landing: snap and sub-pixel layout. */
const CLOSE = 2

/* About a second at 60fps. Long enough for the grid, the fonts and the sticky
   tiers to settle; short enough that a genuinely impossible target gives up
   rather than fighting a board you have started reading. */
const TRIES = 60

type Spot = { left: number; top: number }

/*
 * Snapping overrides a programmatic scroll — set `scrollLeft` under
 * `scroll-snap-type: both mandatory` and the browser immediately re-snaps to
 * whatever is nearest, which on a freshly rendered board is the first column.
 * So snapping comes off for exactly one frame. This is the whole reason the
 * naive version does not work, and it fails silently: the assignment lands, the
 * scroll event fires, and the position is still 0.
 */
const put = (el: HTMLElement, spot: Spot) => {
  const snap = el.style.scrollSnapType
  el.style.scrollSnapType = "none"
  el.scrollTo({ left: spot.left, top: spot.top, behavior: "instant" })
  el.style.scrollSnapType = snap
}

export const useScrollMemory = (
  scroller: RefObject<HTMLElement | null>,
  /* Anything whose change can move the board under you — the lanes, in
     practice. */
  revision: unknown,
) => {
  const at = useRef<Spot | null>(null)
  const want = useRef<Spot | null>(null)
  const restoring = useRef(false)
  const read = useRef(false)

  /*
   * Tracked in a ref, never in state. This fires on every frame of a swipe, and
   * a board that re-rendered at 60fps while you scrolled it would be a worse
   * bug than the one being fixed.
   *
   * Written to storage on a short debounce as well as on the way out. The exit
   * events are the ones that matter and the ones Android is least reliable
   * about, so the position is already on disk before either of them is missed.
   */
  useEffect(() => {
    const el = scroller.current
    if (!el) return

    let settle: ReturnType<typeof setTimeout>

    const track = () => {
      /* Our own restore is not an observation, and treating it as one is what
         let a clamped attempt overwrite the target. */
      if (restoring.current) return

      at.current = { left: el.scrollLeft, top: el.scrollTop }

      /* You moved it yourself, so stop trying to move it for you. */
      want.current = null

      clearTimeout(settle)
      settle = setTimeout(() => {
        try {
          sessionStorage.setItem(KEY, JSON.stringify(at.current))
        } catch {}
      }, 150)
    }

    el.addEventListener("scroll", track, { passive: true })
    return () => {
      clearTimeout(settle)
      el.removeEventListener("scroll", track)
    }
  }, [scroller])

  /*
   * `pagehide` is the one that fires when Android takes the page away, and it
   * is not guaranteed to be followed by anything. `visibilitychange` covers the
   * ordinary app switch. Both, because neither alone is reliable on mobile.
   */
  useEffect(() => {
    const save = () => {
      if (!at.current) return
      try {
        sessionStorage.setItem(KEY, JSON.stringify(at.current))
      } catch {
        /* Private window, or storage refused. Losing the position is the
           correct failure; there is nothing to tell the user about. */
      }
    }
    const onHidden = () => {
      if (document.visibilityState === "hidden") save()
    }

    document.addEventListener("visibilitychange", onHidden)
    window.addEventListener("pagehide", save)
    return () => {
      document.removeEventListener("visibilitychange", onHidden)
      window.removeEventListener("pagehide", save)
    }
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return

    if (!read.current) {
      read.current = true
      try {
        const saved = sessionStorage.getItem(KEY)
        const spot = saved ? (JSON.parse(saved) as Spot) : undefined
        if (spot && (spot.left || spot.top)) want.current = spot
      } catch {}
    }

    if (!want.current) return

    let frame = 0
    let tries = 0

    /*
     * Retried rather than attempted. On a fresh document the board streams: the
     * shell paints, then the lanes arrive, then the grid resolves `64vw`
     * columns and the sticky tiers settle. A restore before any of that is
     * clamped to whatever fits, which is usually zero — and one attempt at the
     * wrong moment is indistinguishable from no memory at all.
     */
    const reach = () => {
      const spot = want.current
      if (!spot) return

      restoring.current = true
      put(el, spot)
      restoring.current = false

      const landed =
        Math.abs(el.scrollLeft - spot.left) < CLOSE &&
        Math.abs(el.scrollTop - spot.top) < CLOSE

      if (landed) {
        at.current = spot
        want.current = null
        return
      }

      if (++tries < TRIES) frame = requestAnimationFrame(reach)
      else want.current = null
    }

    frame = requestAnimationFrame(reach)
    return () => cancelAnimationFrame(frame)
  }, [scroller, revision])
}

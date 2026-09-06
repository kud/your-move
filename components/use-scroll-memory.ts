"use client"

import { useEffect, useRef, type RefObject } from "react"

/*
 * The board remembers where you were.
 *
 * Tapping a card opens GitHub, which on a phone means leaving the app entirely.
 * Coming back, the position was gone — and on a board that scrolls in two axes
 * with twenty-one lanes, "gone" means finding your place again by hand every
 * single time you read a ticket. That is the one interaction this app exists to
 * make cheap, so losing it there is worse than losing it anywhere else.
 *
 * Two different things destroy it and both are handled here, because from the
 * outside they are indistinguishable:
 *
 *   1. Android froze or discarded the page while you were on GitHub, and the
 *      return is a fresh document. Nothing in memory survives, so the position
 *      has to have been written down before leaving.
 *   2. The app came back, refetched, and re-sorted the lanes by urgency. The
 *      element you were snapped to has moved or been rebuilt underneath you,
 *      and a mandatory snap resolves that by snapping somewhere else.
 *
 * Not `scrollRestoration`: the browser's own mechanism covers the document
 * scroller across a history navigation, and this is an inner element across an
 * app switch. It has never applied here.
 */

const KEY = "ym:scroll"

type Spot = { left: number; top: number }

/*
 * Snapping overrides a programmatic scroll — set `scrollLeft` under
 * `scroll-snap-type: both mandatory` and the browser immediately re-snaps to
 * whatever is nearest, which on a freshly rendered board is the first column.
 * So snapping comes off for exactly one frame. This is the whole reason the
 * naive version of this hook does not work, and it fails silently: the
 * assignment lands, the scroll event fires, and the position is still 0.
 */
const put = (el: HTMLElement, spot: Spot) => {
  const snap = el.style.scrollSnapType
  el.style.scrollSnapType = "none"
  el.scrollTo({ left: spot.left, top: spot.top, behavior: "instant" })
  requestAnimationFrame(() => {
    el.style.scrollSnapType = snap
  })
}

export const useScrollMemory = (
  scroller: RefObject<HTMLElement | null>,
  /* Anything whose change can move the board under you — the lanes, in
     practice. Re-checked rather than re-applied: see below. */
  revision: unknown,
) => {
  const at = useRef<Spot | null>(null)
  const read = useRef(false)

  /*
   * Tracked in a ref, never in state. This fires on every frame of a swipe, and
   * a board that re-rendered at 60fps while you scrolled it would be a worse
   * bug than the one being fixed.
   */
  useEffect(() => {
    const el = scroller.current
    if (!el) return

    const track = () => {
      at.current = { left: el.scrollLeft, top: el.scrollTop }
    }
    el.addEventListener("scroll", track, { passive: true })
    return () => el.removeEventListener("scroll", track)
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
        if (saved) at.current = JSON.parse(saved) as Spot
      } catch {}
    }

    const spot = at.current
    if (!spot || (!spot.left && !spot.top)) return

    /*
     * Only when something else moved us, which is what keeps this from fighting
     * you: a deliberate scroll back to the start writes 0 into `at` as well, so
     * the two agree and nothing is re-applied. It restores only where the board
     * says one thing and your last real scroll said another.
     */
    if (el.scrollLeft === spot.left && el.scrollTop === spot.top) return

    put(el, spot)
  }, [scroller, revision])
}

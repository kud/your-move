"use client"

import { useEffect, useState } from "react"

/*
 * "This is going to GitHub."
 *
 * On Android, tapping a card fires an intent that hands over to the GitHub app,
 * and that takes a second or two during which this app looks frozen — the tap
 * registered, nothing moved, and the only honest reading available to you is
 * that it did not work. One line fills that gap.
 *
 * Three decisions in it, and each is the reason it is not annoying:
 *
 *   1. **Narrow only.** On a desk an external link opens a tab, which is
 *      instant and self-announcing; a notice in the tab you are leaving behind
 *      would be a message about something that already happened.
 *   2. **It never blocks.** The navigation is not waited on, deferred or
 *      confirmed. This is a report, not a gate — a confirmation dialog on every
 *      link would cost a tap to say what the link already said.
 *   3. **It dismisses itself three ways.** The app going to the background is
 *      the success case and clears it; coming back clears it; and a timeout
 *      clears it when the intent silently fails to fire at all. A notice that
 *      can outlive its reason is worse than no notice, because the next thing
 *      you do is tap it to make it go away.
 *
 * Delegated from the document rather than wired into each link. There are seven
 * places that open GitHub today and there will be more; a prop threaded through
 * all of them is a list to keep in step, and the one that gets forgotten is the
 * one that looks broken.
 */

/* Long enough to cover a slow hand-off, short enough that a failed one does not
   leave you looking at a lie. */
const GIVE_UP_MS = 4000

const shorten = (href: string) => {
  try {
    const url = new URL(href)
    if (url.hostname !== "github.com") return url.hostname
    const path = url.pathname.replace(/^\/+|\/+$/g, "")
    /* `kud/your-move/issues/12` reads better as `kud/your-move#12`, which is
       what the card said before you tapped it. */
    const issue = path.match(/^(.+?)\/(?:issues|pull)\/(\d+)$/)
    return issue ? `${issue[1]}#${issue[2]}` : path || "github.com"
  } catch {
    return "GitHub"
  }
}

export const Leaving = () => {
  const [going, setGoing] = useState<string>()

  useEffect(() => {
    const leave = (event: MouseEvent) => {
      /* The desktop card handler calls `preventDefault` to open the panel
         instead; nothing is leaving. */
      if (event.defaultPrevented || event.button !== 0) return
      if (!matchMedia("(max-width: 767px)").matches) return

      const target = event.target as Element | null
      const anchor = target?.closest?.<HTMLAnchorElement>('a[target="_blank"]')
      const href = anchor?.getAttribute("href") ?? ""
      if (!/^https?:/i.test(href)) return

      setGoing(shorten(href))
    }

    document.addEventListener("click", leave)
    return () => document.removeEventListener("click", leave)
  }, [])

  useEffect(() => {
    if (!going) return

    const clear = () => setGoing(undefined)
    const timer = setTimeout(clear, GIVE_UP_MS)

    document.addEventListener("visibilitychange", clear)
    window.addEventListener("pagehide", clear)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", clear)
      window.removeEventListener("pagehide", clear)
    }
  }, [going])

  if (!going) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="ym-in-fade fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6 md:hidden"
    >
      <div className="ym-in-modal w-full max-w-[300px] rounded-2xl border border-line bg-panel p-4 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)]">
        <p className="text-[14.5px] font-semibold">Opening on GitHub</p>
        <p className="mt-1 break-all font-mono text-[12px] text-fg-quiet">
          {going}
        </p>
        {/* A bar rather than a spinner: reduced motion zeroes every animation
            on the page, and a frozen spinner reads as a hang. A bar that is not
            moving still reads as a bar. */}
        <span
          aria-hidden
          className="mt-3 block h-[2px] overflow-hidden rounded-full bg-line"
        >
          <span className="ym-crawl block h-full w-1/3 rounded-full bg-accent" />
        </span>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"

/*
 * One tooltip for the whole app, in the top layer, positioned by hand.
 *
 * Four decisions, each of which had a plausible alternative:
 *
 * `popover`, not a pseudo-element. The board is made of `overflow-hidden` — the
 * scroller, every grid cell, the detail panel — so a `::after` tooltip would be
 * clipped exactly where most of these live. Only the top layer escapes that,
 * which is the same reason `About` is a popover and says so.
 *
 * `manual`, not `auto`, and this one is load-bearing: an auto popover closes
 * every other open auto popover outside its ancestor chain, and this app has
 * three — the filters sheet, the menu sheet and `About`. A hover tooltip on
 * `auto` would dismiss whichever was open. The cost of `manual` is owning every
 * dismissal, including the one that is easy to forget: the anchor being removed
 * while the tooltip is up, which otherwise leaves it floating over nothing.
 *
 * Positioned in JS rather than with CSS anchor positioning. The two are not
 * alternatives — anchoring is the tether and does nothing about clipping — so
 * the only question was which tether, and JavaScript is already required for
 * the hover trigger. Anchor positioning needs iOS Safari 26, fails by rendering
 * top-left of the viewport rather than degrading, and its real strength is
 * following an anchor on scroll, which a tooltip does not want: scrolling
 * should dismiss it.
 *
 * Mouse only. `pointerenter` fires on tap on iOS, so without the guard every
 * tooltip becomes tap-to-show on the device this board is mostly read on.
 */

const GAP = 8
const IN_MS = 400
const OUT_MS = 80

type Anchor = { el: HTMLElement; text: string }

let show: ((next: Anchor | null) => void) | undefined

/** Mounted once, near the root. */
export const TooltipLayer = () => {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Anchor | null>(null)

  useEffect(() => {
    show = setTip
    return () => {
      show = undefined
    }
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return

    if (!tip) {
      el.hidePopover?.()
      return
    }

    /* Measured after showing: a popover has no size until it is in the top
       layer, so a rect taken before this is zero and the flip is guesswork. */
    el.showPopover?.()
    const anchor = tip.el.getBoundingClientRect()
    const self = el.getBoundingClientRect()

    const below = anchor.bottom + GAP
    const above = anchor.top - self.height - GAP
    const top = above < 0 ? below : above
    const left = Math.min(
      Math.max(GAP, anchor.left + anchor.width / 2 - self.width / 2),
      window.innerWidth - self.width - GAP,
    )

    el.style.top = `${top}px`
    el.style.left = `${left}px`

    /* Every way out. Scroll and anchor-removal are the two that leave a tooltip
       stranded if they are missed. */
    const close = () => setTip(null)
    const gone = new MutationObserver(() => {
      if (!tip.el.isConnected) close()
    })
    gone.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("scroll", close, true)
    window.addEventListener("blur", close)
    return () => {
      gone.disconnect()
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("blur", close)
    }
  }, [tip])

  return (
    <div
      ref={box}
      popover="manual"
      role="tooltip"
      aria-hidden
      className="ym-tip fixed m-0 max-w-[min(260px,60vw)] rounded-md border border-line bg-raise px-2 py-1 text-[12px] leading-[1.4] text-fg shadow-[0_8px_24px_-12px_rgba(0,0,0,.9)]"
    >
      {tip?.text}
    </div>
  )
}

/*
 * Spread onto any element that wants one. `aria-hidden` on the layer plus a
 * real `aria-label` on the trigger is the split: the tooltip is decoration for
 * the eye, and the accessible name is carried by the control itself — never by
 * a floating element a screen reader would have to find.
 */
export const tip = (text: string | undefined) =>
  text
    ? {
        onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
          if (e.pointerType !== "mouse") return
          const el = e.currentTarget
          window.clearTimeout(timer)
          timer = window.setTimeout(() => show?.({ el, text }), IN_MS)
        },
        onPointerLeave: () => {
          window.clearTimeout(timer)
          timer = window.setTimeout(() => show?.(null), OUT_MS)
        },
        onPointerDown: () => {
          window.clearTimeout(timer)
          show?.(null)
        },
      }
    : {}

let timer: number | undefined

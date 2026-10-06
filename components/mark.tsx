"use client"

/*
 * The mark, inlined rather than fetched.
 *
 * 700 bytes of path data is cheaper than the request that would go and get it,
 * and an asset the service worker does not precache renders as a broken image
 * on the offline page — which is the one screen where a broken logo would be
 * the most visible thing on it.
 *
 * `aria-hidden` because the `<h1>` beside it already says "Your Move": a mark
 * that announces the name a second time is noise in a screen reader, not
 * redundancy that helps.
 *
 * The left half is `--color-brand`, the right half is `currentColor`. Rose is
 * `--color-accent` here, and in this app that value means exactly one thing —
 * "this needs you" — so the mark deliberately spends none of it: a permanent
 * rose object in the same header as the live count would read as fighting it.
 * Blue is a brand colour with no state meaning, which is what makes it safe to
 * wear permanently. If the two ever read as fighting, the fix is to firm up
 * the companion half, not to shrink the mark.
 */

import { useState } from "react"

const LEFT =
  "M73 38 C59 36 49 41 39 51 C35 55 33 60 33 65 L33 264 C33 270 36 275 41 278 L92 311 C97 314 104 315 109 311 C114 308 116 304 116 300 L116 165 C116 162 119 161 123 164 L198 208 C202 210 206 208 211 205 L245 179 C249 176 251 171 251 162 C251 157 248 153 244 150 L90 47 C85 43 79 40 73 38 Z"

const RIGHT =
  "M355 44 C346 38 336 37 326 39 L219 109 C216 111 217 114 220 116 L285 156 C290 159 291 164 289 167 L202 226 C197 230 192 229 187 226 L149 200 L148 242 C148 247 151 251 155 254 L194 278 C198 280 202 280 206 278 L280 231 C284 228 287 230 287 234 L287 302 C287 308 292 313 298 314 C302 314 307 313 311 310 L363 274 C366 272 368 267 368 262 L368 66 C368 58 363 50 355 44 Z"

export const Mark = ({ className }: { className?: string }) => {
  const [hopping, setHopping] = useState(false)

  return (
    /*
     * The latch for the hop in `app/globals.css`: a `:hover` animation stops
     * the moment the pointer leaves, mid-salto. This adds the class on entry
     * and drops it when the animation ends, so the turn always plays through.
     * Mouse only, and never under `data-motion="reduce"` — the CSS media query
     * holds the first half of that and the guard below the second.
     */
    <span
      className="inline-flex shrink-0"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return
        if (document.documentElement.dataset.motion === "reduce") return
        setHopping(true)
      }}
      onAnimationEnd={() => setHopping(false)}
    >
      <svg
        viewBox="0 0 400 352"
        aria-hidden
        className={`text-fg ${className ?? ""}${hopping ? " ym-hop-play" : ""}`}
      >
        <path fill="var(--color-brand)" d={LEFT} />
        <path fill="currentColor" d={RIGHT} />
      </svg>
    </span>
  )
}

/*
 * The mark at rest, in one colour.
 *
 * Monochrome for the reason the coloured one carries in its own comment above:
 * rose means "this needs you" on this board, and the empty board is the single
 * screen where nothing does. A rose object there would spend the signal on the
 * one moment that has nothing to signal.
 *
 * `currentColor` also makes it ONE drawing rather than two. The light theme had
 * to re-derive the accent rather than invert it — that is what a second
 * illustration would have cost — and the thing needing re-derivation was the
 * rose. Take it out and the shape works on any ground, including
 * `data-contrast="high"`, where it gets firmer rather than needing a special
 * case.
 *
 * No knockout seam: the two halves are separated by a negative-space channel,
 * so in one colour the boundary holds on its own. The stroke this used to
 * carry existed only because the old halves overlapped.
 */
export const MarkMono = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 400 352" aria-hidden className={className}>
    <g fill="currentColor">
      <path d={LEFT} />
      <path d={RIGHT} />
    </g>
  </svg>
)

/*
 * The section alphabet, drawn.
 *
 * These were text glyphs — `○ @ ↑ ↓ ◇ ◆ ✓ ▫ •` — and three separate things
 * were wrong with that, only the first of which looks like a styling problem:
 *
 *   1. `place-items-center` centres a glyph's LINE BOX, not its ink. `↑ ↓ ○ ◇`
 *      are drawn about the em centre and landed well; `✓` sits on the baseline
 *      with its mass at the top, `@` hangs a bowl below centre, `▫` is small and
 *      low by design. Four of seven fine and three visibly off is the worst
 *      available distribution — it reads as sloppiness rather than as a system.
 *   2. No common optical size. In a 20px box `✓` filled about 55% and `▫` about
 *      30%, and `◇`/`◆` were not one silhouette at two fills but two differently
 *      sized diamonds sharing a name.
 *   3. Not one family, by construction. `ui-monospace` is SF Mono on macOS and
 *      Roboto Mono on Android, and Roboto Mono does not carry `◇ ◆ ▫` in every
 *      build — so on a phone this set was drawn by up to three unrelated
 *      typefaces. No amount of box tuning reaches that.
 *
 * Iris's geometry, and the reasoning is worth keeping because a later edit will
 * otherwise undo it: ink lives in a concentric 10×10 band inside a 12 viewBox,
 * with round and pointed marks overshooting by ~0.4px — which is what makes a
 * circle and a square look the same size. `stroke-width` is 1.25 against the
 * container's 1px border, so the mark leads and the box follows; equal weights
 * are what made a glyph read as furniture. There is no text in the box, so
 * nothing sits on a baseline: every mark is optically centred on (6,6),
 * including the two that are asymmetric.
 *
 * `@` is gone deliberately. It was the only typographic character in the set
 * and would never sit with six geometric marks; a filled dot inside an open
 * ring says "aimed at you", pairs with `issues`' empty ring, and separates by
 * fill rather than by hue — which is this board's own rule.
 */

import type { ReactNode } from "react"

const MARKS: Record<string, ReactNode> = {
  issues: <circle cx="6" cy="6" r="4.6" />,
  assigned: (
    <>
      <circle cx="6" cy="6" r="4.6" />
      <circle cx="6" cy="6" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  open: (
    <>
      <path d="M6 10.4V2.2" />
      <path d="M2.6 5.6 6 2.2l3.4 3.4" />
    </>
  ),
  /* The same paths mirrored in y, exactly, so the pair reads as a pair. */
  incoming: (
    <>
      <path d="M6 1.6v8.2" />
      <path d="M2.6 6.4 6 9.8l3.4-3.4" />
    </>
  ),
  review: <path d="M6 1.1 10.9 6 6 10.9 1.1 6Z" />,
  /* Identical path, filled. That the two were not one shape is most of why the
     pair never read as a pair. */
  reviewed: <path d="M6 1.1 10.9 6 6 10.9 1.1 6Z" fill="currentColor" />,
  /* Extents 3.3 to 9.1, centred on 6.2 rather than 6: a tick reads high if you
     centre its bounding box, because the long arm carries the mass. */
  done: <path d="M2.2 6.4 4.9 9.1 9.8 3.3" />,
  draft: <rect x="1.9" y="1.9" width="8.2" height="8.2" rx="1.6" />,
}

const FALLBACK = (
  <circle cx="6" cy="6" r="1.6" fill="currentColor" stroke="none" />
)

export const SectionMark = ({
  id,
  className = "size-3",
}: {
  id: string
  className?: string
}) => (
  <svg
    viewBox="0 0 12 12"
    aria-hidden
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {MARKS[id] ?? FALLBACK}
  </svg>
)

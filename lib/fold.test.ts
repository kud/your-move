import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { FOLD_MS, LEAD_MS } from "@/components/board"

/*
 * The seam between a stylesheet and a `setTimeout`.
 *
 * A fold plays in two beats — the cards fade, then the box compresses — and
 * both beats are timed in CSS. `board.tsx` has to know how long the pair takes
 * so it can unmount the cards once they are over, and it cannot ask: CSS will
 * not hand a number to a timer and TypeScript cannot reach into a stylesheet.
 * So the numbers are written twice, and until this file existed nothing checked
 * they still agreed.
 *
 * The drift is one-directional and quiet, which is what earns the test. If the
 * constants LEAD the stylesheet the cards leave the tree mid-animation, and
 * what you see is a fold that plays half of itself and then cuts — which reads
 * as a rendering glitch rather than as a number someone changed. If they lag,
 * nothing is visible at all and a few dozen cards simply stay mounted longer
 * than they need to. Neither raises anything.
 *
 * Same move as `lib/sections.test.ts` asserting the board's track widths
 * against `BOARD_W`: where two pieces of code must agree about one number,
 * they consult the same source or a test says so.
 */

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

/** A duration token as declared in `@theme`, in milliseconds. */
const token = (name: string) => {
  const found = css.match(new RegExp(`--dur-${name}:\\s*(\\d+)ms;`))
  expect(found, `globals.css declares --dur-${name}`).not.toBeNull()
  return Number(found?.[1])
}

/** The declaration block of a single class rule. */
const rule = (selector: string) => {
  const found = css.match(
    new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`.replace(/-/g, "\\-")),
  )
  expect(found, `globals.css declares .${selector}`).not.toBeNull()
  return found?.[1] ?? ""
}

describe("the fold's two beats", () => {
  it("times them with the same numbers board.tsx mirrors", () => {
    expect(token("pointer"), "LEAD_MS mirrors --dur-pointer").toBe(LEAD_MS)
    expect(token("fold"), "FOLD_MS mirrors --dur-fold").toBe(FOLD_MS)
  })

  /*
   * The mirror above is only worth having while the animations still SPEND
   * those two tokens. Repointing `.ym-fold-in` at a third duration would leave
   * both constants perfectly accurate and the unmount timer wrong anyway, so
   * the seam is the pair of names, not the pair of values.
   */
  it("spends exactly those two tokens on the sequence", () => {
    const out = rule("ym-fold-out")
    const going = rule("ym-fold-in")

    expect(out, "the cards leave on --dur-pointer").toContain(
      "var(--dur-pointer)",
    )
    expect(going, "and arrive on it too").toContain("var(--dur-pointer)")
    expect(going, "after waiting out the compress").toContain("var(--dur-fold)")
  })
})

import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { FOLD_MS, LEAD_MS, toggled } from "@/components/board"

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

/*
 * The bookkeeping that keeps the cards mounted while the box travels.
 *
 * Nothing here can be driven through a DOM — there is no browser in this suite
 * and adding one to check an animation would be the wrong trade. So this pins
 * the two properties whose absence Erwann could see, in the same source-reading
 * idiom the block above uses on the stylesheet.
 *
 * Both were real, and both were invisible slowly. The bug was intermittent
 * because a passive effect flushes either side of a paint depending on what
 * else the frame is doing; testing it by hand, one toggle at a time, it behaves
 * perfectly.
 */
const board = readFileSync(
  new URL("../components/board.tsx", import.meta.url),
  "utf8",
)

describe("what stays mounted through a fold", () => {
  it("reads a toggle in either direction", () => {
    const was = new Set(["a", "b"])

    expect(toggled(was, new Set(["a", "b", "c"])), "one folded").toEqual(["c"])
    expect(toggled(was, new Set(["a"])), "one unfolded").toEqual(["b"])
    expect(toggled(was, was), "nothing moved").toEqual([])
  })

  /*
   * A render-phase derivation, never an effect. From an effect the flag is one
   * paint behind the prop it describes, and the cards' mount condition reads
   * both — so the first painted frame of a fold had them already gone, and the
   * effect remounted them to play the fade from the top.
   */
  it("derives the settle sets while rendering", () => {
    expect(board, "the lane axis is derived from the prop it saw last").toMatch(
      /if \(seenFolded !== folded\) \{/,
    )
    expect(board, "and never from an effect keyed on the prop").not.toMatch(
      /\}, \[folded\]\)/,
    )
    expect(board, "the column axis likewise").not.toMatch(/\}, \[cols\]\)/)
  })

  /*
   * One timer covers every lane in flight, so the set has to accumulate: a
   * replace evicted a lane that was still compressing the moment a second one
   * was folded, and its cards left the tree mid-travel. Keying the timer on the
   * set rather than on the prop is what restarts it on re-entry.
   */
  it("accumulates them, and restarts the one clock on re-entry", () => {
    expect(board, "lanes accumulate").toMatch(
      /setSettling\(\(held\) => new Set\(\[\.\.\.held, \.\.\.changed\]\)\)/,
    )
    expect(board, "columns accumulate").toMatch(
      /setSettlingCols\(\(held\) => new Set\(\[\.\.\.held, \.\.\.changed\]\)\)/,
    )
    expect(board, "and the unmount clock is keyed on the set").toMatch(
      /\}, \[settling\]\)/,
    )
    expect(board, "on both axes").toMatch(/\}, \[settlingCols\]\)/)
  })
})

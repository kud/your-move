import { describe, expect, it } from "vitest"

import { byCellOrder } from "./order.js"
import type { Row } from "./github.js"

/*
 * The ordering rule is three keys deep and every one of its failures is silent:
 * a wrong order is still a plausible order, and a cell that hides everything
 * past the fourth row turns "sorted slightly wrong" into "not there at all".
 * These assert the two extremes the middle rule was chosen against, so a future
 * rewrite that lands on either one fails here rather than on his phone.
 */

const row = (
  move: "you" | "them",
  health: Row["health"],
  ts: number,
  name: string,
) => ({ move, health, ts, name })

const order = (rows: ReturnType<typeof row>[]) =>
  [...rows].sort(byCellOrder).map((r) => r.name)

describe("byCellOrder", () => {
  it("puts your rows above theirs, whatever moved most recently", () => {
    expect(
      order([
        row("them", "none", 200, "theirs-newer"),
        row("you", "none", 100, "yours-older"),
      ]),
    ).toEqual(["yours-older", "theirs-newer"])
  })

  it("sinks your draft below your work that is actually asking", () => {
    expect(
      order([
        row("you", "draft", 300, "draft-touched-today"),
        row("you", "conflict", 100, "conflicting-last-week"),
      ]),
    ).toEqual(["conflicting-last-week", "draft-touched-today"])
  })

  /*
   * The half the library's own rule would get wrong here. `sortItems` sinks a
   * draft across the whole repo; applied to a cell that shows four rows, that
   * puts your unfinished work under a stranger's and out of sight.
   */
  it("keeps your draft above every row that is not yours", () => {
    expect(
      order([
        row("them", "none", 400, "theirs"),
        row("you", "draft", 100, "your-draft"),
      ]),
    ).toEqual(["your-draft", "theirs"])
  })

  it("falls back to most recently moved inside a band", () => {
    expect(
      order([
        row("you", "none", 100, "older"),
        row("you", "none", 300, "newer"),
      ]),
    ).toEqual(["newer", "older"])
  })

  it("orders drafts among themselves by recency too", () => {
    expect(
      order([
        row("you", "draft", 100, "older-draft"),
        row("you", "draft", 300, "newer-draft"),
      ]),
    ).toEqual(["newer-draft", "older-draft"])
  })
})

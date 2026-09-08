import { describe, expect, it } from "vitest"

import { byCellOrder, byLaneOrder } from "./order.js"
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

/*
 * A lane order that is wrong is still a lane order, and the only person who
 * could notice is one who already knew where the lane should have been. These
 * pin the two things pinning promised: that it leads under BOTH modes, and that
 * it changes nothing else about either.
 */
const lane = (repo: string, yours: number, total: number) => ({
  repo,
  yours,
  total,
})

const lanes = (
  how: "urgency" | "name",
  pins: string[],
  ls: ReturnType<typeof lane>[],
) => [...ls].sort(byLaneOrder(how, new Set(pins))).map((l) => l.repo)

describe("byLaneOrder", () => {
  it("leaves urgency exactly as it was when nothing is pinned", () => {
    expect(
      lanes("urgency", [], [
        lane("kud/quiet", 0, 9),
        lane("kud/one-of-yours", 1, 1),
        lane("kud/busiest", 4, 40),
      ]),
    ).toEqual(["kud/busiest", "kud/one-of-yours", "kud/quiet"])
  })

  it("lifts a quiet pinned project over one that is shouting", () => {
    expect(
      lanes("urgency", ["kud/quiet"], [
        lane("kud/busiest", 4, 40),
        lane("kud/quiet", 0, 1),
      ]),
    ).toEqual(["kud/quiet", "kud/busiest"])
  })

  /* The point of a leading key rather than a third mode: inside each group the
     order you chose is untouched. */
  it("keeps the chosen order within the pinned group and within the rest", () => {
    expect(
      lanes("urgency", ["kud/pinned-quiet", "kud/pinned-loud"], [
        lane("kud/loose-loud", 3, 30),
        lane("kud/pinned-quiet", 0, 2),
        lane("kud/loose-quiet", 0, 1),
        lane("kud/pinned-loud", 2, 20),
      ]),
    ).toEqual([
      "kud/pinned-loud",
      "kud/pinned-quiet",
      "kud/loose-loud",
      "kud/loose-quiet",
    ])
  })

  it("leads under the name sort too, not only under urgency", () => {
    expect(
      lanes("name", ["kud/zebra"], [
        lane("kud/apple", 0, 1),
        lane("kud/zebra", 0, 1),
        lane("kud/mango", 0, 1),
      ]),
    ).toEqual(["kud/zebra", "kud/apple", "kud/mango"])
  })

  it("sorts by the name you can see, not by owner/repo", () => {
    expect(
      lanes("name", [], [lane("zzz/apple", 0, 1), lane("aaa/zebra", 0, 1)]),
    ).toEqual(["zzz/apple", "aaa/zebra"])
  })

  /* A pin promotes; it never conjures. A repository with no lane has no row to
     sort, so an empty or filtered-out pin is simply absent — and returns the
     moment it has something to show. */
  it("cannot bring back a lane that the board is not drawing", () => {
    expect(
      lanes("urgency", ["kud/absent"], [lane("kud/present", 0, 1)]),
    ).toEqual(["kud/present"])
  })
})

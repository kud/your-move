import { describe, expect, it } from "vitest"

import { byCellOrder, byLaneOrder } from "./order.js"
import type { Row } from "./github.js"

/*
 * The ordering rule is four keys deep and every one of its failures is silent:
 * a wrong order is still a plausible order, and a cell that hides everything
 * past the fourth row turns "sorted slightly wrong" into "not there at all".
 * These assert the two extremes the middle rule was chosen against, so a future
 * rewrite that lands on either one fails here rather than on his phone.
 */

const row = (
  move: "you" | "them" | "unknown",
  health: Row["health"],
  ts: number,
  name: string,
) => ({ move, health, ts, name })

/*
 * No `now` by default, which makes the heat key inert and leaves every
 * assertion below testing exactly what it tested before heat existed. The heat
 * block passes one explicitly.
 */
const order = (
  rows: ReturnType<typeof row>[],
  column = "review",
  now?: number,
) => [...rows].sort(byCellOrder(column, now)).map((r) => r.name)

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

/*
 * The durable principle from the library, asserted again on this side of the
 * wire. `whoseMove` can be right and the board still wrong: a cell that ranked
 * `unknown` alongside `them` would put these rows back exactly where
 * `includes(undefined)` had them, and nothing would look broken.
 */
describe("byCellOrder and the third verdict", () => {
  it("ranks an unclassified row between the two verdicts", () => {
    expect(
      order([
        row("them", "none", 300, "theirs"),
        row("unknown", undefined, 200, "unclassified"),
        row("you", "none", 100, "yours"),
      ]),
    ).toEqual(["yours", "unclassified", "theirs"])
  })

  it("never lets a row we declined to judge sink below one we judged not-yours", () => {
    expect(
      order([
        row("them", "approved", 999, "theirs-and-fresh"),
        row("unknown", undefined, 1, "unclassified-and-stale"),
      ])[0],
    ).toBe("unclassified-and-stale")
  })

  it("still keeps a known-yours row above an unclassified one", () => {
    expect(
      order([
        row("unknown", undefined, 999, "unclassified-and-fresh"),
        row("you", "none", 1, "yours-and-stale"),
      ])[0],
    ).toBe("yours-and-stale")
  })

  it("orders unclassified rows among themselves by recency", () => {
    expect(
      order([
        row("unknown", undefined, 100, "older"),
        row("unknown", undefined, 300, "newer"),
      ]),
    ).toEqual(["newer", "older"])
  })
})

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

/*
 * The regression these pin is not a wrong comparator, it is a comparator that
 * went FLAT. Filling in the third tier's verdicts made key one constant across
 * the review column, drafts are rare there, and recency alone then decided
 * which four of a hundred rows a cell drew — so the oldest thing on the board
 * could be folded under `+N more` by four things touched this morning, with
 * nothing on screen saying so.
 *
 * Anything that reintroduces that flatness passes every test above this line.
 */
const DAY = 86_400_000
const NOW = Date.UTC(2026, 8, 9)
const daysAgo = (days: number) => NOW - days * DAY

describe("byCellOrder and staleness", () => {
  it("lifts a stale review request above fresher ones that would fold it away", () => {
    expect(
      order(
        [
          row("you", "none", daysAgo(0.1), "fresh-1"),
          row("you", "none", daysAgo(0.2), "fresh-2"),
          row("you", "none", daysAgo(0.3), "fresh-3"),
          row("you", "none", daysAgo(0.4), "fresh-4"),
          row("you", "none", daysAgo(9), "waiting-nine-days"),
        ],
        "review",
        NOW,
      )[0],
    ).toBe("waiting-nine-days")
  })

  it("ranks hot above warm above neither", () => {
    expect(
      order(
        [
          row("you", "none", daysAgo(0), "cool"),
          row("you", "none", daysAgo(3), "warm"),
          row("you", "none", daysAgo(6), "hot"),
        ],
        "review",
        NOW,
      ),
    ).toEqual(["hot", "warm", "cool"])
  })

  it("still orders by recency inside one heat band, rather than by age", () => {
    expect(
      order(
        [
          row("you", "none", daysAgo(6), "hot-newer"),
          row("you", "none", daysAgo(30), "hot-older"),
        ],
        "review",
        NOW,
      ),
    ).toEqual(["hot-newer", "hot-older"])
  })

  it("never lets heat carry a row of theirs above one of yours", () => {
    expect(
      order(
        [
          row("them", "none", daysAgo(60), "theirs-and-ancient"),
          row("you", "none", daysAgo(0), "yours-and-fresh"),
        ],
        "review",
        NOW,
      ),
    ).toEqual(["yours-and-fresh", "theirs-and-ancient"])
  })

  /*
   * The deliberate limit of the guarantee. A draft is not asking, which is what
   * key two exists to say, so heat promotes within the asking rows and does not
   * overrule them. A hot draft sinking is the correct answer, not a gap.
   */
  it("never lets heat carry a draft above work that is actually asking", () => {
    expect(
      order(
        [
          row("you", "draft", daysAgo(60), "draft-and-ancient"),
          row("you", "none", daysAgo(0), "asking-and-fresh"),
        ],
        "review",
        NOW,
      ),
    ).toEqual(["asking-and-fresh", "draft-and-ancient"])
  })

  it("leaves the order untouched in a column with no staleness band", () => {
    expect(
      order(
        [
          row("you", "none", daysAgo(400), "ancient"),
          row("you", "none", daysAgo(0), "fresh"),
        ],
        "done",
        NOW,
      ),
    ).toEqual(["fresh", "ancient"])
  })

  /*
   * A board restored from a cache written before `fetchedAt` existed, and the
   * server pass before the clock means anything. Degrading to the old
   * comparator is the direction to fail in; degrading to a guessed heat is not.
   */
  it("degrades to plain recency when the read has no moment", () => {
    expect(
      order([
        row("you", "none", daysAgo(400), "ancient"),
        row("you", "none", daysAgo(0), "fresh"),
      ]),
    ).toEqual(["fresh", "ancient"])
  })
})

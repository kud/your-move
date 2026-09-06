import type { Row } from "@/lib/github"

/*
 * How rows are ordered inside one cell of the board.
 *
 * Extracted and tested rather than left inline, because the bug it now pins
 * failed silently for as long as it existed: `@kud/gh-workflow`'s `sortItems`
 * deliberately sinks drafts — "a draft is not asking" — and the board re-sorted
 * every cell from scratch, which discarded that intent without a single symptom
 * anyone could point at. Nothing threw, nothing logged; a draft touched an hour
 * ago simply sat above a PR that had been conflicting for a week. A rewrite of
 * this comparator would lose it again exactly the same way.
 *
 * Three keys, and the middle one is the whole decision:
 *
 *   1. Yours before theirs. The board exists to answer whose move it is.
 *   2. Within a band, drafts last. This is a NARROWING of the library's rule,
 *      not a copy. Sinking a draft across the whole cell would drop your own
 *      unfinished work below a stranger's — and a cell shows four rows and
 *      hides the rest, so below is gone. Your draft still outranks everything
 *      that is not yours, and yields to the work of yours that is asking.
 *   3. Most recently moved.
 */

type Ordered = Pick<Row, "move" | "health" | "ts">

export const byCellOrder = (a: Ordered, b: Ordered): number =>
  Number(b.move === "you") - Number(a.move === "you") ||
  Number(a.health === "draft") - Number(b.health === "draft") ||
  b.ts - a.ts

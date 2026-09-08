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

/*
 * A repository as it is shown: the board draws the name, never `owner/repo`,
 * so the name sort must agree with what is on screen.
 */
export const shortName = (repo: string) => repo.split("/").pop() ?? repo

/*
 * How the lanes themselves are ordered down the left edge.
 *
 * Extracted for the same reason `byCellOrder` is: an ordering bug here is
 * invisible. A wrong lane order is still a plausible lane order, and the only
 * person who could notice is someone who already knew where the lane should
 * have been.
 *
 * Urgency by default, and that is the app's name rather than an arbitrary
 * choice: Your Move puts the thing that wants you at position one. Sorted by
 * name it would be a repository list, and there are a great many repository
 * lists. The alternative exists for the opposite want — a project always being
 * in the same place, for when you arrive looking for one by name rather than
 * reading down what is in front of you. By the name you can SEE, not
 * `owner/repo`, since the owner is not on screen.
 *
 * Two dynamic states only. A third — "recently active" — would deliver none of
 * the stability that motivates the second one, and would need "active by whom,
 * on what" answered first: a data decision wearing a sort's costume. Theo's
 * call, and it stands.
 *
 * Pinning is a LEADING KEY, not a third mode. `ym:order` is deliberately two
 * states — the comment on the sort it wraps rules out a third dynamic order —
 * and a pin does not breach that: it reorders within whichever mode is on and
 * leaves the order inside each group exactly as it was. Both modes get it, so
 * "pinned" means the same thing wherever you are standing.
 *
 * It promotes and never hides. A pin cannot conjure a lane that has no rows,
 * which is why an empty pinned repository has no lane on a quiet day and none
 * under a filter that excludes it: `picks` is a query and decides what exists,
 * a pin is a preference and only decides what comes first. The pin survives in
 * storage and reasserts the moment the lane is back.
 */
type Laned = { repo: string; yours: number; total: number }

export const byLaneOrder =
  (order: "urgency" | "name", pinned: ReadonlySet<string>) =>
  (a: Laned, b: Laned): number =>
    Number(pinned.has(b.repo)) - Number(pinned.has(a.repo)) ||
    (order === "name"
      ? shortName(a.repo).localeCompare(shortName(b.repo))
      : Number(b.yours > 0) - Number(a.yours > 0) ||
        b.yours - a.yours ||
        b.total - a.total)

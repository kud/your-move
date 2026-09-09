import type { Move } from "@kud/gh-workflow"

import type { Row } from "@/lib/github"
import { type Heat, heatOf } from "@/lib/sections"

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
 * Four keys, and the middle two are the whole decision:
 *
 *   1. Yours before theirs. The board exists to answer whose move it is.
 *   2. Within a band, drafts last. This is a NARROWING of the library's rule,
 *      not a copy. Sinking a draft across the whole cell would drop your own
 *      unfinished work below a stranger's — and a cell shows four rows and
 *      hides the rest, so below is gone. Your draft still outranks everything
 *      that is not yours, and yields to the work of yours that is asking.
 *   3. Hot before warm before neither.
 *   4. Most recently moved.
 */

type Ordered = Pick<Row, "move" | "health" | "ts">

/*
 * `you` → `unknown` → `them`, and the middle place is the whole point.
 *
 * A two-way key would tie `unknown` with `them`, which is precisely where
 * `includes(undefined)` already put these rows before the library grew a third
 * verdict — the same wrong answer with a type on it to make it look deliberate.
 *
 * The bands rank CLAIMS ON YOUR ATTENTION, not confidence in the reading, and
 * `them` is the one band that exists to be skipped. A row we could not rule out
 * therefore outranks one we ruled out. It also cannot outrank a row we know is
 * yours, because it might not be. `@kud/gh-workflow` sorts its bands the same
 * way; a cell that disagreed would contradict the column it sits in.
 */
const RANK: Record<Move, number> = { you: 0, unknown: 1, them: 2 }

/*
 * Age, ranked rather than merely drawn — and it is a REGRESSION FIX, not a
 * feature, which is why it earns a key rather than a badge.
 *
 * Before the third health tier, most of the review column answered `unknown`
 * and the first key did real work inside it. Filling those verdicts in made
 * key one CONSTANT across that column: everything resolves to `you`, drafts are
 * rare there, and what is left deciding the cell is recency alone. A cell draws
 * four. So a review request sitting nine days could be pushed under `+18 more`
 * by four things touched this morning, and the fold said nothing about having
 * swallowed the oldest thing on the board.
 *
 * The differentiator already existed and was already tuned per column —
 * `STALE_AFTER` in `lib/sections.ts`, drawn on the row as the ember. It just
 * did not rank. Reusing it costs no new concept and no new constant, and it
 * satisfies the house rule that a ranking's reason must be legible on the row:
 * the row that climbed is the row wearing the mark.
 *
 * IT SITS BELOW `draft`, DELIBERATELY. Above it, a nine-day-old draft of yours
 * would climb over a two-day-old review request — and a draft is not asking,
 * which is the one thing key two exists to say. So the guarantee is "a hot row
 * cannot fall behind the cap among the rows that are asking", not "no hot row
 * can ever be folded". A hot draft still sinks, and that is the correct answer
 * rather than a gap in this one.
 *
 * It is NOT `oldest first`. Within a heat band the order is still most-recent
 * first, so the key promotes the stale band and does not invert the column.
 */
const HEAT_RANK: Record<Heat | "none", number> = { hot: 0, warm: 1, none: 2 }

/*
 * Curried on `(column, now)` for the reason `byLaneOrder` is curried on its
 * mode: both are facts about the READ, not about the row, and both are constant
 * across the sort they parameterise — a cell is one lane in one column.
 *
 * Putting `heat` on the `Row` instead was the other candidate and is the worse
 * one. `Row` is fetched, cached and restored; heat is derived against the
 * moment of the read (`fetchedAt`, never `Date.now()` — see `heatOf`), so a row
 * carrying its own heat would carry a stale one out of the cache. That is the
 * mirror-versus-cache distinction this app is built on, arriving one field at a
 * time.
 *
 * `now` stays optional and an absent one collapses the key to zero, which is
 * exactly today's ordering. A board restored before `fetchedAt` existed, or
 * rendered on the server before the clock is meaningful, degrades to the old
 * comparator rather than to a guess.
 */
export const byCellOrder =
  (column: string, now?: number) =>
  (a: Ordered, b: Ordered): number =>
    RANK[a.move] - RANK[b.move] ||
    Number(a.health === "draft") - Number(b.health === "draft") ||
    HEAT_RANK[heatOf(column, a.ts, now) ?? "none"] -
      HEAT_RANK[heatOf(column, b.ts, now) ?? "none"] ||
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

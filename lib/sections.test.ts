import { describe, expect, it } from "vitest"

import { INBOX_SOURCES } from "@kud/gh/inbox"

import { COLUMNS, sectionOf } from "@/components/board"
import { PRESENTED_SECTIONS } from "@/lib/sections"
import type { Row } from "@/lib/github"

/*
 * The contract `lib/sections.ts` was written to have and never got.
 *
 * Its own header records why: a rename in `@kud/gh` left ten of twelve columns
 * falling through to the fallback, rendering the same mark in the same tone,
 * for four days, with nothing saying so. A fallback is indistinguishable from a
 * design decision — that is the entire failure mode, and it is why this is a
 * test rather than a runtime warning nobody would read.
 *
 * `@kud/gh` is a pinned dependency that gets bumped. This asserts both
 * directions across that seam, because only one of them is the one that hurt:
 *
 *   → a source the library emits that this app has no presentation for
 *     renders as furniture and says nothing;
 *   ← a key kept here after the library dropped it is dead weight that reads
 *     as still supported, which is how the map got stale enough for the first
 *     to happen at all.
 */

const asRow = (source: string) => ({ source }) as unknown as Row

describe("the section contract with @kud/gh", () => {
  it("gives every source the library emits a column to land in", () => {
    for (const source of INBOX_SOURCES)
      expect(COLUMNS, `${source} has no column`).toContain(
        sectionOf(asRow(source)),
      )
  })

  it("gives every column a presentation of its own", () => {
    for (const column of COLUMNS)
      expect(
        PRESENTED_SECTIONS,
        `${column} would render the fallback`,
      ).toContain(column)
  })

  /*
   * The direction that catches rot rather than breakage. It found one the day
   * it was written: a `draft` presentation for a column that no longer exists,
   * unreachable from any source, sitting in the map looking supported.
   */
  it("keeps no presentation for a column that no longer exists", () => {
    for (const presented of PRESENTED_SECTIONS)
      expect(COLUMNS, `${presented} is presented but never rendered`).toContain(
        presented,
      )
  })

  it("reaches every column from at least one source", () => {
    const reached = new Set(INBOX_SOURCES.map((s) => sectionOf(asRow(s))))
    for (const column of COLUMNS)
      expect(reached, `nothing can ever appear in ${column}`).toContain(column)
  })
})

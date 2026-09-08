import { readFileSync } from "node:fs"

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

/*
 * The boot skeleton draws the same grid as the board, but `.ym-skeleton-grid`
 * in `globals.css` spells its track count out as a literal — deliberately, so
 * that one grid depends on no custom property that could fail to resolve. CSS
 * cannot read `COLUMNS`, so this is the thing standing between a new column and
 * a shell that quietly hands over to a board of a different shape.
 */
describe("the skeleton's hardcoded track count", () => {
  const source = (rel: string) =>
    readFileSync(new URL(rel, import.meta.url), "utf8")

  it("still matches the board's column count", () => {
    expect(COLUMNS).toHaveLength(7)
  })

  /*
   * And its track WIDTHS, which is the half the count test did not cover.
   *
   * The lane and the column are spelled out in three places that cannot see one
   * another — `LANE_W`/`COL_W`, the scroller's Tailwind class list, and this
   * CSS — and the first time one of them moved without the others, the shell
   * would hand over to a board of a different width. That is the same reflow the
   * chip row used to cause, on the other axis and harder to spot, because a
   * board 30px wider than its own skeleton looks like nothing until you put the
   * two frames side by side. Read as text on purpose: importing `board.tsx` here
   * would pull React in for two numbers.
   */
  it("still matches the board's own track widths", () => {
    const board = source("../components/board.tsx")
    /* The values are arbitrary-property syntax, so they hold parens and commas
       but never a `]` — which is what makes this greedy-safe. */
    const token = (name: string) =>
      board.match(new RegExp(`md:\\[--ym-${name}:([^\\]]+)\\]`))?.[1]

    /* Two blocks declare it — the narrow one, then the `md` override. */
    const tracks = [
      ...source("../app/globals.css").matchAll(
        /\.ym-skeleton-grid\s*\{[\s\S]*?grid-template-columns:\s*([^;]+);/g,
      ),
    ].map((m) => m[1].trim())

    const lane = token("lane")
    const col = token("col")
    const tail = token("tail")
    for (const [name, value] of [
      ["lane", lane],
      ["col", col],
      ["tail", tail],
    ] as const)
      expect(value, `the board declares md --ym-${name}`).toBeDefined()
    expect(tracks).toHaveLength(2)

    /*
      The skeleton spells out what the board reaches for through a token, so the
      two are compared after substituting the one back-reference and dropping
      whitespace — CSS is free to be formatted, a track list is not free to
      differ. `COLUMNS.length` appears on both sides because the divisor inside
      the clamp is the number CSS cannot derive.
    */
    const flat = (s: string) => s.replace(/\s+/g, "")
    expect(flat(tracks[1] ?? "")).toBe(
      flat(
        `${lane} repeat(${COLUMNS.length}, ${col?.replaceAll("var(--ym-lane)", lane ?? "")}) ${tail}`,
      ),
    )
  })

  /*
   * The divisor inside the wide `--ym-col` is `COLUMNS.length` written out as a
   * digit, because a CSS `calc` cannot count an array. Folding survives a
   * stretching board only while it stays the CONSTANT seven — see the comment on
   * the scroller — so this is the assertion standing between an eighth column and
   * six columns that resize every time one of them is folded.
   */
  it("divides the wide column by the real column count", () => {
    const divisor = source("../components/board.tsx").match(
      /md:\[--ym-col:[^\]]*var\(--ym-lane\)\)\/(\d+)\)/,
    )?.[1]
    expect(divisor).toBe(String(COLUMNS.length))
  })
})


import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { INBOX_SOURCES } from "@kud/gh/inbox"

import { BOARD_W, cellRule, COLUMNS, DONE, sectionOf } from "@/components/board"
import { heatOf, PRESENTED_SECTIONS, STALE_AFTER } from "@/lib/sections"
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
   * two frames side by side.
   *
   * The CLASS LIST and the CSS are read as text because there is no other way
   * to reach them — a Tailwind arbitrary value and a stylesheet are not
   * importable. The constants are a different matter: this file already imports
   * `board.tsx` at the top, so `BOARD_W` costs nothing and is asserted below.
   * (A note here used to say the import would pull React in for two numbers.
   * That stopped being true when `COLUMNS` and `sectionOf` were imported, and
   * it was the argument keeping the seam untested.)
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

/*
 * Whether the board fits the box that holds it — which is the whole of whether a
 * horizontal scrollbar appears.
 *
 * The numbers are read out of the class list rather than restated here, because a
 * test that carries its own copy of the arithmetic agrees with itself forever. It
 * models one thing CSS does and the source cannot say: seven tracks and a lane,
 * laid inside a frame that is capped, inside a panel that has a border.
 *
 * Both directions matter, and the second is the one worth guarding. A board that
 * never overflows is not the goal — below the clamp's floor the columns stop
 * shrinking and the board MUST overflow, or there is no way to reach the last
 * column at all. The bug being pinned is an overflow of two pixels; the failure
 * this could be traded for is a board that cannot be scrolled to its own end.
 */
describe("the board against the box that holds it", () => {
  const board = readFileSync(
    new URL("../components/board.tsx", import.meta.url),
    "utf8",
  )

  const col = board.match(
    /md:\[--ym-col:clamp\((\d+)px,calc\(\(100dvw-([\d.]+)rem-(\d+)px-var\(--ym-lane\)\)\/(\d+)\),(\d+)px\)\]/,
  )
  const lane = Number(board.match(/md:\[--ym-lane:(\d+)px\]/)?.[1])
  const frameRem = Number(
    board.match(/md:max-w-\[calc\(var\(--ym-frame\)_\+_([\d.]+)rem\)\]/)?.[1],
  )
  const border = Number(board.match(/const PANEL_BORDER_W = (\d+)/)?.[1])

  it("declares every number this rests on", () => {
    expect(
      col,
      "the wide --ym-col is in the shape this test reads",
    ).not.toBeNull()
    for (const [name, value] of [
      ["lane", lane],
      ["frame gutters", frameRem],
      ["panel border", border],
    ] as const)
      expect(Number.isFinite(value), `the board declares ${name}`).toBe(true)
  })

  const [floor, gutterRem, guard, divisor, ceiling] = (col ?? [])
    .slice(1)
    .map(Number)
  const REM = 16
  const gutters = frameRem * REM

  /* The clamp and the frame have to be told the same gutter, or the frame stops
     growing at a different width from the columns and one of them is wrong. */
  it("subtracts the same gutters the frame adds", () => {
    expect(gutterRem).toBe(frameRem)
  })

  it("keeps enough slack for seven tracks to round without overflowing", () => {
    expect(guard).toBeGreaterThan(border)
  })

  const widest = lane + divisor * ceiling + border
  const colAt = (vw: number) =>
    Math.min(ceiling, Math.max(floor, (vw - gutters - guard - lane) / divisor))
  /* The frame is `mx-auto max-w-…`, so it is the viewport until the cap bites. */
  const scrollerBoxAt = (vw: number) =>
    Math.min(vw, widest + gutters) - gutters - border
  const gridAt = (vw: number) => lane + divisor * colAt(vw)

  /*
   * The one comparison that crosses the gap — and for a while it did not.
   *
   * This asserted `widest` against the very expression `widest` is defined
   * from, three lines above: `lane + divisor * ceiling + border` on both sides.
   * It could not fail. That is worse than an absent test, because it was green
   * and it was named after the check it was not performing, and the name is
   * what stops anyone looking twice.
   *
   * `widest` is parsed out of the scroller's TAILWIND CLASS LIST; `BOARD_W` is
   * computed from the TYPESCRIPT CONSTANTS. Those are the two sources with no
   * way to see each other, so this is the seam the rest of the file exists to
   * pin. Without it, moving `LANE_W` to 200 while leaving `md:[--ym-lane:180px]`
   * alone left every test passing and the frame running 20px past its own grid.
   */
  it("matches the frame cap the component actually exports", () => {
    expect(widest).toBe(BOARD_W)
  })

  it("never overflows while the columns are still stretching", () => {
    const over: number[] = []
    for (let vw = 768; vw <= 4000; vw++)
      if (colAt(vw) > floor && gridAt(vw) > scrollerBoxAt(vw)) over.push(vw)
    expect(
      over,
      "viewports where a scrollbar appears with room to spare",
    ).toEqual([])
  })

  it("still overflows below the clamp's floor, so the last column stays reachable", () => {
    expect(colAt(1440)).toBe(floor)
    expect(gridAt(1440)).toBeGreaterThan(scrollerBoxAt(1440))
  })

  it("fills the plateau exactly, with no trailing void", () => {
    expect(gridAt(3840)).toBe(scrollerBoxAt(3840))
  })

  /*
   * A folded column is 52px of rail where a column was, and the track divides by
   * the constant count — so folding only ever makes the grid narrower. Pinned
   * because the reverse (recomputing from what is showing) is the tempting change
   * and it would put both the resize and the overflow back.
   */
  it("cannot overflow because a column is folded", () => {
    const rail = Number(board.match(/\[--ym-rail:(\d+)px\]/)?.[1])
    expect(Number.isFinite(rail)).toBe(true)
    for (let vw = 2400; vw <= 4000; vw++)
      expect(lane + (divisor - 1) * colAt(vw) + rail).toBeLessThanOrEqual(
        scrollerBoxAt(vw),
      )
  })
})

/*
 * Staleness heat is a per-column threshold, so the thing that can go wrong is
 * not the arithmetic — it is a column quietly having no opinion, or having the
 * wrong one, on a board where a column is added by editing an array.
 */
describe("how long a row may sit before the card says so", () => {
  it("has an opinion about every column that is still live work", () => {
    for (const column of COLUMNS.filter((c) => c !== DONE))
      expect(
        STALE_AFTER[column],
        `${column} says when it is stale`,
      ).toBeDefined()
  })

  /* Not an oversight to be filled in later: there is no age at which a finished
     thing becomes a problem, and a threshold there would set the archive alight. */
  it("has no opinion about the archive", () => {
    expect(STALE_AFTER[DONE]).toBeUndefined()
  })

  it("never puts hot before warm", () => {
    for (const [column, band] of Object.entries(STALE_AFTER))
      expect(band.hot, `${column} gets hotter, not cooler`).toBeGreaterThan(
        band.warm,
      )
  })

  it("marks nothing in the archive, however old", () => {
    const now = Date.UTC(2026, 0, 1)
    expect(heatOf(DONE, now - 400 * 86_400_000, now)).toBeUndefined()
  })

  /*
   * The one that would have shipped. `ts` is 0 — not undefined — when the item
   * had no date to sort on, and 0 is 1970: without the guard every such card
   * would be maximally, permanently on fire, and it would look like a real
   * signal rather than like missing data.
   */
  it("does not set an item with no date alight", () => {
    expect(heatOf("review", 0, Date.UTC(2026, 0, 1))).toBeUndefined()
  })

  it("says nothing until the read's own timestamp is known", () => {
    expect(heatOf("review", Date.UTC(2020, 0, 1), undefined)).toBeUndefined()
  })

  it("steps at its own thresholds and not before", () => {
    const now = Date.UTC(2026, 0, 1)
    const band = STALE_AFTER.review
    expect(band).toBeDefined()
    const at = (days: number) => heatOf("review", now - days * 86_400_000, now)

    expect(at(band!.warm - 0.01)).toBeUndefined()
    expect(at(band!.warm)).toBe("warm")
    expect(at(band!.hot - 0.01)).toBe("warm")
    expect(at(band!.hot)).toBe("hot")
    expect(at(band!.hot * 10)).toBe("hot")
  })
})

/*
 * The board's right edge belongs to the panel's border, not to a column.
 *
 * A seam on the final column has nothing on its far side, and it cannot sit
 * where the panel's border sits — a border is outside the content box the grid
 * is laid in. So the two can only ever be adjacent, which reads as one edge
 * drawn badly rather than as two edges.
 */
describe("the board's right edge", () => {
  it("is not drawn twice", () => {
    expect(cellRule(COLUMNS.at(-1) ?? "")).toBe("")
  })

  it("still separates every column that has one beside it", () => {
    for (const column of COLUMNS.slice(0, -1))
      expect(cellRule(column), `${column} keeps its seam`).toContain("border-r")
  })
})

import { describe, expect, it } from "vitest"

import type { Inbox } from "@/lib/github"

import { envelope, MAX_AGE_MS, usable } from "./kept.js"

/*
 * What may be believed after a round trip through a browser's storage — which
 * before this was "anything", since the read was a `JSON.parse` cast straight to
 * `Inbox`.
 *
 * Two failures are being pinned and they fail in opposite directions. A board
 * from a previous model renders WITHOUT THROWING and is wrong, which is the one
 * that survives a smoke test. A board from an arbitrary distance in the past
 * renders correctly and answers a question nobody asked — "what moved" as of
 * three weeks ago — while carrying an age label the reader has stopped reading.
 *
 * `usable` is pure so this needs no browser. The storage wrappers around it hold
 * no policy worth asserting: they are try/catch and a key name.
 */

const NOW = Date.UTC(2026, 8, 8, 12, 0, 0)

const inbox = (over: Partial<Inbox> = {}): Inbox =>
  ({
    rows: [],
    failed: [],
    reasons: [],
    fetchedAt: NOW,
    ...over,
  }) as Inbox

describe("what may be read back out of storage", () => {
  it("accepts what it just wrote", () => {
    expect(usable(envelope(inbox()), NOW)).toEqual(inbox())
  })

  it("keeps the board's own fetchedAt, so the age stays honest", () => {
    const anHourAgo = NOW - 3_600_000
    expect(usable(envelope(inbox({ fetchedAt: anHourAgo })), NOW)?.fetchedAt).toBe(
      anHourAgo,
    )
  })

  /*
   * The one that would have shipped. Before the envelope there was no version
   * at all, so this is also the shape every board written before today has.
   */
  it("refuses a board with no version stamp", () => {
    expect(usable(inbox(), NOW)).toBeUndefined()
  })

  it("refuses a board from a different model version", () => {
    expect(usable({ ...envelope(inbox()), v: 99 }, NOW)).toBeUndefined()
  })

  it("refuses anything that is not the shape it claims", () => {
    for (const bad of [
      undefined,
      null,
      "a string",
      42,
      {},
      { v: 1 },
      { v: 1, inbox: null },
      { v: 1, inbox: {} },
      { v: 1, inbox: { rows: [], failed: [] } },
      { v: 1, inbox: { rows: "no", failed: [], fetchedAt: NOW } },
      { v: 1, inbox: { rows: [], failed: [], fetchedAt: "recently" } },
    ])
      expect(usable(bad, NOW), `${JSON.stringify(bad)} is not a board`).toBeUndefined()
  })

  describe("the age ceiling", () => {
    const at = (age: number) => usable(envelope(inbox({ fetchedAt: NOW - age })), NOW)

    it("shows a board from an hour ago", () => {
      expect(at(3_600_000)).toBeDefined()
    })

    it("shows one from the last moment before the ceiling", () => {
      expect(at(MAX_AGE_MS - 1)).toBeDefined()
    })

    it("refuses one past the ceiling", () => {
      expect(at(MAX_AGE_MS + 1)).toBeUndefined()
    })

    /*
     * A board stamped after now is a clock that moved — a timezone change, a
     * device whose time was wrong when it was written. Refused rather than
     * clamped to zero: the age label is the only thing making a stale board
     * honest, and "0 min ago" on a board of unknown vintage is the precise lie
     * this file exists to prevent.
     */
    it("refuses one stamped in the future", () => {
      expect(usable(envelope(inbox({ fetchedAt: NOW + 60_000 })), NOW)).toBeUndefined()
    })
  })
})

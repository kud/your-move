import { describe, expect, it } from "vitest"

import type { Inbox } from "@/lib/github"

import {
  BUDGET_FLOOR,
  LEAN_PULSE_GAP_MS,
  PULSE_GAP_MS,
  STALE_AFTER_MS,
  freshnessText,
  isStale,
  mayAskAlone,
  pulseGap,
  pulseOutcome,
  refreshName,
  sameBoard,
} from "./pulse.js"

/*
 * The pulse's rules are all silent when wrong: a missed change is a board that
 * looks fine, a spurious one is budget spent quietly, and a wording slip is a
 * header that claims "no change" beside "may be out of date". These pin each
 * one at its edge.
 */

const MIN = 60_000
const T = 1_700_000_000_000

describe("pulseOutcome", () => {
  const ask = (over: Partial<Parameters<typeof pulseOutcome>[0]> = {}) =>
    pulseOutcome({
      baseline: "a",
      fingerprint: "a",
      now: T,
      lastPulseRead: undefined,
      remaining: 4000,
      ...over,
    })

  it("only records a baseline on the first pulse after a read", () => {
    expect(ask({ baseline: undefined, fingerprint: "b" })).toBe("baseline")
  })

  it("does nothing when the fingerprint matches", () => {
    expect(ask()).toBe("same")
  })

  it("reads on a change when no pulse has caused a read yet", () => {
    expect(ask({ fingerprint: "b" })).toBe("read")
  })

  it("holds a change inside the three-minute gap, and reads after it", () => {
    expect(ask({ fingerprint: "b", lastPulseRead: T - 2 * MIN })).toBe("held")
    expect(ask({ fingerprint: "b", lastPulseRead: T - PULSE_GAP_MS })).toBe(
      "read",
    )
  })

  it("widens the gap to ten minutes when the budget is low", () => {
    expect(
      ask({ fingerprint: "b", lastPulseRead: T - 5 * MIN, remaining: 1999 }),
    ).toBe("held")
    expect(
      ask({
        fingerprint: "b",
        lastPulseRead: T - LEAN_PULSE_GAP_MS,
        remaining: 1999,
      }),
    ).toBe("read")
  })
})

describe("budget", () => {
  it("widens only below the lean line", () => {
    expect(pulseGap(2000)).toBe(PULSE_GAP_MS)
    expect(pulseGap(1999)).toBe(LEAN_PULSE_GAP_MS)
    expect(pulseGap(undefined)).toBe(PULSE_GAP_MS)
  })

  it("stops asking alone below the floor", () => {
    expect(mayAskAlone(BUDGET_FLOOR)).toBe(true)
    expect(mayAskAlone(BUDGET_FLOOR - 1)).toBe(false)
    expect(mayAskAlone(undefined)).toBe(true)
  })
})

describe("isStale", () => {
  it("keys on confirmation, not on the read", () => {
    expect(isStale(T - STALE_AFTER_MS, T)).toBe(false)
    expect(isStale(T - STALE_AFTER_MS - 1, T)).toBe(true)
  })

  it("is not stale with nothing confirmed yet", () => {
    expect(isStale(undefined, T)).toBe(false)
  })
})

describe("freshnessText", () => {
  const read = T - 14 * MIN

  it("says just now inside a minute of a read", () => {
    expect(
      freshnessText({
        fetchedAt: T - 30_000,
        checkedAt: T,
        now: T,
        live: true,
      }),
    ).toBe("just now")
  })

  it("gives the bare age with no pulse since the read", () => {
    expect(
      freshnessText({
        fetchedAt: read,
        checkedAt: undefined,
        now: T,
        live: true,
      }),
    ).toBe("14 min ago")
    expect(
      freshnessText({
        fetchedAt: read,
        checkedAt: read - MIN,
        now: T,
        live: true,
      }),
    ).toBe("14 min ago")
  })

  it("says no change once a pulse has confirmed the read", () => {
    expect(
      freshnessText({
        fetchedAt: read,
        checkedAt: T - 40_000,
        now: T,
        live: true,
      }),
    ).toBe("no change in 14 min")
    expect(
      freshnessText({
        fetchedAt: T - 2 * 60 * MIN,
        checkedAt: T,
        now: T,
        live: true,
      }),
    ).toBe("no change in 2 hr")
  })

  it("drops the no-change wording once the board is no longer live", () => {
    expect(
      freshnessText({
        fetchedAt: T - 21 * MIN,
        checkedAt: T - 9 * MIN,
        now: T,
        live: false,
      }),
    ).toBe("21 min ago")
  })
})

describe("refreshName", () => {
  it("carries the seconds the header drops", () => {
    expect(
      refreshName({
        fetchedAt: T - 14 * MIN,
        checkedAt: T - 40_000,
        now: T,
        busy: false,
      }),
    ).toBe("Refresh. Read from GitHub 14 min ago, checked 40 s ago, no change.")
  })

  it("leaves out the check when no pulse followed the read", () => {
    expect(
      refreshName({
        fetchedAt: T - 14 * MIN,
        checkedAt: undefined,
        now: T,
        busy: false,
      }),
    ).toBe("Refresh. Read from GitHub 14 min ago.")
  })

  it("is Refreshing while a pressed refresh is in flight", () => {
    expect(
      refreshName({ fetchedAt: T, checkedAt: T, now: T, busy: true }),
    ).toBe("Refreshing")
  })
})

describe("sameBoard", () => {
  const board = (rows: unknown[], fetchedAt: number) =>
    ({ rows, fetchedAt, failed: [], reasons: [] }) as unknown as Inbox

  it("compares rows and ignores when they were read", () => {
    expect(sameBoard(board([{ url: "a" }], 1), board([{ url: "a" }], 2))).toBe(
      true,
    )
    expect(sameBoard(board([{ url: "a" }], 1), board([{ url: "b" }], 1))).toBe(
      false,
    )
    expect(sameBoard(undefined, board([], 1))).toBe(false)
  })
})

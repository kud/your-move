import { describe, expect, it } from "vitest"

import { reasonFor } from "@/components/board"

import type { Row } from "@/lib/github"

/*
 * The one branch in `reasonFor` that reads a SOURCE rather than a health, and
 * the row it used to get wrong.
 *
 * The ladder is otherwise health-shaped, so the source check is an anomaly
 * sitting in the middle of it — and it silently outranked `draft`, which is the
 * one health whose band CONTRADICTS the chip. `whoseMove` files a queued draft
 * under Their move, and the card then captioned it "Review requested": sunk,
 * and captioned with a reason that did not explain why.
 *
 * Pinned because the ladder drifted once with nothing to catch it.
 */
const row = (over: Partial<Row>) => ({ kind: "pr", ...over }) as Row

describe("reasonFor", () => {
  it("says a review request is a draft, rather than that it was requested", () => {
    expect(reasonFor(row({ source: "reviewRequests", health: "draft" }))).toBe(
      "Draft",
    )
  })

  it("still names the request where nothing about the row contradicts it", () => {
    expect(reasonFor(row({ source: "reviewRequests", health: "waiting" }))).toBe(
      "Review requested",
    )
  })

  it("leaves `approved` below the source check, where band and chip agree", () => {
    expect(
      reasonFor(row({ source: "reviewRequests", health: "approved" })),
    ).toBe("Review requested")
    expect(reasonFor(row({ source: "reviewed", health: "approved" }))).toBe(
      "Approved",
    )
  })

  /* Unreachable in practice — `computeHealth` ranks `draft` above every
     mechanical health — but pinned so the ordering above cannot be "fixed" by
     moving `draft` past the branches that would then shadow it. */
  it("keeps the mechanical healths ahead of draft's new position", () => {
    expect(reasonFor(row({ source: "reviewRequests", health: "ci-fail" }))).toBe(
      "CI failing",
    )
    expect(
      reasonFor(row({ source: "reviewRequests", health: "conflict" })),
    ).toBe("Conflict")
  })

  /* Not on a `reviewRequests` row: the source check sits above the tail, and
     rightly — "you were asked" survives a minimal fetch, so it is a fact rather
     than the confidence the third verdict exists to withhold. */
  it("declines to say `Open` about a row whose health was never fetched", () => {
    expect(reasonFor(row({ source: "repoPRs", move: "unknown" }))).toBe(
      "No verdict",
    )
  })
})
